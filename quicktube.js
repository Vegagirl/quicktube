'use strict';

// TODO has youtube api improved since this was written in 2015?
// Mobile Safari exhibits a number of documented bugs with the
// youtube player API. User agent detection, but you'll live, my boy!
// https://groups.google.com/forum/#!topic/youtube-api-gdata/vPgKhCu4Vng
const isMobileSafari = () => (/Apple.*Mobile.*Safari/).test(navigator.userAgent);

// Inject the YouTube API onto the page.
// TODO It is bad to do this systematically outside of any `init` function –
// - It should be done only on init.
// - It should check whether `YT` exists already so it does not load it multiple times.
const newScriptTag = document.createElement('script');
newScriptTag.src = 'https://www.youtube.com/iframe_api';

const documentScripts = document.getElementsByTagName('script');
if (documentScripts.length > 0) {
    const firstScriptTag = documentScripts[0];
    firstScriptTag.parentNode.insertBefore(newScriptTag, firstScriptTag);
}

const Quicktube = {

    _settings: '?autoplay=1&showinfo=0&autohide=1&color=white&enablejsapi=1&playerapiid=ytplayer&wmode=transparent',
    _domain: 'https://www.youtube.com/embed/',
    _players: {},
    // TODO Decide which settings you want to be able to configure from site init
    options: {
        trackAnalytics: false,
        activeClass: 'quicktube--playing',
        pausedClass: 'quicktube--paused',
        posterFrameHiddenClass: 'quicktube__poster--hidden',
        autoplay: 1,
        showInfo: 0,
        autohide: 1,
        color: 'white',
        enablejsapi: 1,
        wmode: 'transparent',
    },
    iframeClass: 'quicktube__iframe',
    activeClass: 'quicktube--playing',
    pausedClass: 'quicktube--paused',
    posterFrameHiddenClass: 'quicktube__poster--hidden',
    setExplicitFrameHeight: false,

    init(options) {
        // this.options = this.extend(this.options, options);
        // TODO is this what that extend function is actually trying to do?
        this.options = Object.assign(this.options || {}, options);

        const playButton = document.querySelector('[data-quicktube-play]');
        const stopButton = document.querySelector('[data-quicktube-stop]');

        playButton.addEventListener('click', this.onClick.bind(this, playButton), false);

        playButton.addEventListener('keydown', (e) => {
            if(e.keyCode == 13) {
                this.onClick.call(this, playButton);
            }
        }, false);

        stopButton.addEventListener('click', (e) => {
            const videoId = e.target.getAttribute('data-quicktube-stop');
            this.stopVideo.call(this, videoId);
        }, false);
    },

    onClick(el) {
        const parentId = el.getAttribute('data-quicktube-play');
        let parentEl = el.parentElement;
        let videoContainer = parentEl.querySelector('[data-quicktube-video]');

        // defines whether video has already been loaded and you want to play again
        const videoIframes = videoContainer.getElementsByTagName('iframe');
        let video = false;
        if (videoIframes.length > 0) {
            video = videoIframes[0];
        }

        const videoId = videoContainer.getAttribute('data-quicktube-video');
        const poster = parentEl.querySelector('[data-quicktube-poster]');

        const onPlayerReady = (e) => {
            if (!isMobileSafari()) {
                if (parentEl.getAttribute('data-video-playing')) {
                    this.stopVideo.call(this, parentId);
                } else {
                    parentEl.getAttribute('data-video-playing');
                    e.target.playVideo();
                }
            }
        };

        // listen for play, pause and end states
        // also report % played every second
        const onPlayerStateChange = (e) => {
            e['data'] == YT.PlayerState.PLAYING && setTimeout(onPlayerPercent, 1000, e['target']);
            const video_data = e.target['getVideoData']();
            let label = video_data.title;
            // Get title of the current page
            const pageTitle = document.title;

            if(this.options.trackAnalytics) {
                if (e['data'] == YT.PlayerState.PLAYING && YT.gaLastAction == 'p') {
                    label = `Video Played - ${video_data.title}`;
                    this.trackEvent({
                        'event': 'youtube',
                        'eventCategory': 'Youtube Videos',
                        'eventAction': pageTitle,
                        'eventLabel': label
                    });
                    YT.gaLastAction = "";
                }

                if (e['data'] == YT.PlayerState.PAUSED) {
                    label = `Video Paused - ${video_data.title}`;
                    this.trackEvent({
                        'event': 'youtube',
                        'eventCategory': 'Youtube Videos',
                        'eventAction': pageTitle,
                        'eventLabel': label
                    });
                    YT.gaLastAction = 'p';
                }
            }

            if (e['data'] == YT.PlayerState.ENDED) {
                this.stopVideo.call(this, parentId);
            }
        }

        // catch all to report errors through the GTM data layer
        // once the error is exposed to GTM, it can be tracked in UA as an event!
        const onPlayerError = (e) => {
            if(this.options.trackAnalytics) {
                this.trackEvent({
                    'event': 'error',
                    'eventCategory': 'Youtube Videos',
                    'eventAction': 'GTM',
                    'eventLabel': `youtube:${e['target']['src']}-${e['data']}`
                })
            };
        };

        // report the % played if it matches 0%, 25%, 50%, 75% or completed
        const onPlayerPercent = (e) => {
            if (e['getPlayerState']() == YT.PlayerState.PLAYING) {
                if(this.options.trackAnalytics) {
                    const time = e['getDuration']() - e['getCurrentTime']() <= 1.5 ? 1 : (Math.floor(e['getCurrentTime']() / e['getDuration']() * 4) / 4).toFixed(2);
                    if (!e['lastP'] || time > e['lastP']) {
                        const video_data = e['getVideoData']();
                        let label = video_data.title;
                        // Get title of the current page
                        const pageTitle = document.title;
                        e['lastP'] = time;
                        label = `${time * 100}% Video played - ${video_data.title}`;
                        this.trackEvent({
                            'event': 'youtube',
                            'eventCategory': 'Youtube Videos',
                            'eventAction': pageTitle,
                            'eventLabel': label
                        })
                    }
                    e['lastP'] != 1 && setTimeout(onPlayerPercent, 1000, e);
                }
            }
        }

        if (!video) {
            video = this.getIframePlayer(videoId, parentEl, parentId);
            videoContainer.appendChild(video);

            this.quicktubePlayer = new YT.Player(parentId, {
                events: {
                    'onStateChange': onPlayerStateChange,
                    'onReady': onPlayerReady,
                    'onError': onPlayerError
                }
            });
            YT.gaLastAction = 'p';
        }

        if (!isMobileSafari()) {
            if (this.quicktubePlayer.playVideo) {
                this.quicktubePlayer.playVideo();
            }
        }

        // TODO does this ever get set to true? if so how?
        // Doesn't appear to be an overridable setting
        if (this.setExplicitFrameHeight) {
            video.setAttribute('height', parentEl.offsetHeight);
        }

        if (!parentEl.getAttribute('data-video-playing')) {
            this.hidePosterFrame(poster);
            this._players[parentId] = parentEl;
            parentEl.classList.add(this.activeClass);
            parentEl.classList.remove(this.pausedClass);
            window.dispatchEvent(new Event('quicktube:play'));
        }
    },

    hidePosterFrame(poster) {
        poster.classList.add(this.posterFrameHiddenClass);
    },

    showPosterFrame(poster) {
        poster.classList.remove(this.posterFrameHiddenClass);
    },

    getIframePlayer(id, parent, parentId) {
        let iframe = document.createElement('iframe');
        iframe.src = this._domain + id + this._settings;
        iframe.width = '100%';
        iframe.id = parentId;
        iframe.className = this.iframeClass;
        return iframe;
    },

    stopVideo(parentId) {
        let playerEl = document.querySelector(`[data-quicktube='${parentId}']`);

        if(!this.quicktubePlayer) {
            return;
        }

        this.quicktubePlayer.pauseVideo();
        playerEl.classList.remove(this.activeClass);
        playerEl.classList.add(this.pausedClass);
        this.showPosterFrame(playerEl.querySelector('[data-quicktube-poster]'));
        playerEl.getAttribute('data-video-playing');
        this._players[parentId] = false;
        window.dispatchEvent(new Event('quicktube:pause'));
    },

    trackEvent(event) {
        if (typeof window._gaq === 'object') {
            window._gaq.push(['_trackEvent', event.eventCategory, event.eventAction, event.eventLabel]);
        } else if (typeof window.ga === "function") {
            window.ga('send', 'event', event.eventCategory, event.eventAction, event.eventLabel);
        } else {
        }
    },
};

// Export this to window directly.
window.onYouTubeIframeAPIReady = () => {
    Quicktube.init();
};

module.exports = Quicktube;

//     'use strict';

//     // Mobile Safari exhibits a number of documented bugs with the
//     // youtube player API. User agent detection, but you'll live, my boy!
//     // https://groups.google.com/forum/#!topic/youtube-api-gdata/vPgKhCu4Vng
//     var isMobileSafari = function() {
//         return (/Apple.*Mobile.*Safari/).test(navigator.userAgent);
//     };

//     var tag = document.createElement('script');
//       tag.src = "https://www.youtube.com/iframe_api";
//       var firstScriptTag = document.getElementsByTagName('script')[0];
//       firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

//     var QT = {
//         options: {
//             trackAnalytics: false
//         },
//         _settings: "?autoplay=1&showinfo=0&autohide=1&color=white&enablejsapi=1&playerapiid=ytplayer&wmode=transparent",
//         _domain: "https://www.youtube.com/embed/",
//         _players: {},
//         className: "quicktube__iframe",
//         activeClass: "quicktube--playing",
//         pausedClass: "quicktube--paused",
//         posterFrameHiddenClass: "quicktube__poster--hidden",
//         supportsTransitions: ('transition' in document.body.style || 'webkitTransition' in document.body.style || 'MozTransition' in document.body.style || 'msTransition' in document.body.style || 'OTransition' in document.body.style),
//         setExplicitFrameHeight: false,
//         init: function(options) {
//             var self = this;
//             self.options = self.extend(self.options, options);
//             $("[data-quicktube-play]").on("click", function() {
//                 self.onClick.call(self, $(this));
//             });
//             $("[data-quicktube-play]").on("keydown", function(e) {
//                 if(e.keyCode == 13) {
//                     self.onClick.call(self, $(this));
//                 }
//             });
//             $("[data-quicktube-stop]").on("click", function() {
//                 var videoId = $(this).data("quicktube-stop");
//                 self.stopVideo.call(self, videoId);
//             });
//             return this;
//         },

//         /**
//          * Deep extend object
//          */
//         extend: function(out) {
//             var self = this;
//             out = out || {};
//             for (var i = 1; i < arguments.length; i++) {
//                 var obj = arguments[i];
//                 if (!obj) {
//                     continue;
//                 }
//                 for (var key in obj) {
//                     if (obj.hasOwnProperty(key)) {
//                         if (typeof obj[key] === 'object') {
//                             self.extend(out[key], obj[key]);
//                         } else {
//                             out[key] = obj[key];
//                         }
//                     }
//                 }
//             }
//             return out;
//         },

//         onClick: function($el) {
//             var self = this;
//             var parentId = $el.data("quicktube-play");
//             var parent = $el.closest("[data-quicktube=\"" + parentId + "\"]");
//             var videoContainer = parent.find("[data-quicktube-video]");
//             var $video = $("iframe." + self.className, $videoContainer);
//             var videoId = $videoContainer.data("quicktube-video");
//             var poster = parent.find("[data-quicktube-poster]");

//             var onPlayerReady = function(e) {
//                 if (!isMobileSafari()) {
//                     if (parent.data("video-playing")) {
//                         self.stopVideo.call(self, parentId);
//                     } else {
//                         parent.data("video-playing", true);
//                        e.target.playVideo();
//                     }
//                 }
//             };

//             // listen for play, pause and end states
//             // also report % played every second
//             function onPlayerStateChange(e) {
//                 e["data"] == YT.PlayerState.PLAYING && setTimeout(onPlayerPercent, 1000, e["target"]);
//                 var video_data = e.target["getVideoData"](),
//                     label = video_data.title;
//                 // Get title of the current page
//                 var pageTitle = document.title;

//                 if(self.options.trackAnalytics) {
//                     if (e["data"] == YT.PlayerState.PLAYING && YT.gaLastAction == "p") {
//                         label = "Video Played - " + video_data.title;
//                         self.trackEvent({
//                             'event': 'youtube',
//                             'eventCategory': 'Youtube Videos',
//                             'eventAction': pageTitle,
//                             'eventLabel': label
//                         });
//                         YT.gaLastAction = "";
//                     }

//                     if (e["data"] == YT.PlayerState.PAUSED) {
//                         label = "Video Paused - " + video_data.title;
//                         self.trackEvent({
//                             'event': 'youtube',
//                             'eventCategory': 'Youtube Videos',
//                             'eventAction': pageTitle,
//                             'eventLabel': label
//                         });
//                         YT.gaLastAction = "p";
//                     }
//                 }

//                 if (e["data"] == YT.PlayerState.ENDED) {
//                     self.stopVideo.call(self, parentId);
//                 }
//             }

//             // catch all to report errors through the GTM data layer
//             // once the error is exposed to GTM, it can be tracked in UA as an event!
//             var onPlayerError = function(e) {
//                 if(self.options.trackAnalytics) {
//                     self.trackEvent({
//                         'event': 'error',
//                         'eventCategory': 'Youtube Videos',
//                         'eventAction': 'GTM',
//                         'eventLabel': "youtube:" + e["target"]["src"] + "-" + e["data"]
//                     })
//                 };
//             };

//             // report the % played if it matches 0%, 25%, 50%, 75% or completed
//             function onPlayerPercent(e) {
//                 if (e["getPlayerState"]() == YT.PlayerState.PLAYING) {
//                     if(self.options.trackAnalytics) {
//                         var t = e["getDuration"]() - e["getCurrentTime"]() <= 1.5 ? 1 : (Math.floor(e["getCurrentTime"]() / e["getDuration"]() * 4) / 4).toFixed(2);
//                         if (!e["lastP"] || t > e["lastP"]) {
//                             var video_data = e["getVideoData"](),
//                                 label = video_data.title;
//                             // Get title of the current page
//                             var pageTitle = document.title;
//                             e["lastP"] = t;
//                             label = t * 100 + "% Video played - " + video_data.title;
//                             self.trackEvent({
//                                 'event': 'youtube',
//                                 'eventCategory': 'Youtube Videos',
//                                 'eventAction': pageTitle,
//                                 'eventLabel': label
//                             })
//                         }
//                         e["lastP"] != 1 && setTimeout(onPlayerPercent, 1000, e);
//                     }
//                 }
//             }

//             if (!$video.length) {
//                 $video = self.getIframePlayer(videoId, parent, parentId);
//                 $videoContainer.html($video);
//                 this.quicktubePlayer = new YT.Player(parentId, {
//                     events: {
//                         'onStateChange': onPlayerStateChange,
//                         'onReady': onPlayerReady,
//                         'onError': onPlayerError
//                     }
//                 });
//                 YT.gaLastAction = "p";
//             }

//             if (!isMobileSafari()) {
//                 if (this.quicktubePlayer.playVideo) {
//                     this.quicktubePlayer.playVideo();
//                 }
//             }

//             if (self.setExplicitFrameHeight) {
//                 $video.height(parent.outerHeight());
//             }

//             if (!parent.data("video-playing")) {
//                 self.hidePosterFrame($poster);
//                 self._players[parentId] = parent;
//                 parent.addClass(self.activeClass).removeClass(self.pausedClass);
//                 $(window).trigger("quicktube:play", parentId, parent);
//             }
//         },

//         hidePosterFrame: function($poster) {
//             var self = this;
//             $poster.addClass(self.posterFrameHiddenClass);
//             if (!self.supportsTransitions) {
//                 $poster.fadeOut(300);
//             }
//         },

//         showPosterFrame: function($poster) {
//             var self = this;
//             $poster.removeClass(self.posterFrameHiddenClass);
//             if (!self.supportsTransitions) {
//                 $poster.fadeIn(300);
//             }
//         },

//         getIframePlayer: function(id, parent, parentId) {
//             var self = this;
//             var src = self._domain + src + self._settings;
//             var iframe = document.createElement("iframe");
//             iframe.src = self._domain + id + self._settings;
//             iframe.width = "100%";
//             iframe.id = parentId;
//             iframe.className = this.className;
//             return $(iframe);
//         },

//         stopVideo: function(parentId) {
//             var self = this;
//             var parent = $("[data-quicktube=\"" + parentId + "\"]");
//             var frame = parent.find("iframe");
//             var func = "pauseVideo";

//             if(!this.quicktubePlayer) {
//                 return;
//             }

//             this.quicktubePlayer.pauseVideo();
//             parent.removeClass(self.activeClass).addClass(self.pausedClass);
//             self.showPosterFrame(parent.find("[data-quicktube-poster]"));
//             parent.data("video-playing", false);
//             self._players[parentId] = false;
//             $(window).trigger("quicktube:pause", parentId, parent);
//         },

//         trackEvent: function (event) {
//             if (typeof window._gaq === "object") {
//                 window._gaq.push(["_trackEvent", event.eventCategory, event.eventAction, event.eventLabel]);
//             } else if (typeof window.ga === "function") {
//                 window.ga('send', 'event', event.eventCategory, event.eventAction, event.eventLabel);
//             } else {
//             }
//         },
//     };

//     // Export this to window directly.
//     window.onYouTubeIframeAPIReady = function() {
//         $(document).ready(function() {
//             QT.init();
//         });
//     };
