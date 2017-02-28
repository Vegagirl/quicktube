/**
 * Quicktube.js
 * http://springload.co.nz/
 *
 * Copyright 2015, Springload
 * Released under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 */

const ROOT = typeof global !== 'undefined' ? global : this.window || this.global;
const SUPPORTS_TRANSITIONS = 'transition' in document.body.style || 'webkitTransition' in document.body.style || 'MozTransition' in document.body.style || 'msTransition' in document.body.style || 'OTransition' in document.body.style;

const isMobileSafari = () => {
    return (/Apple.*Mobile.*Safari/).test(navigator.userAgent);
};

const Quicktube = {

    options: {
        trackAnalytics: false,
    },
    _settings: "?autoplay=1&showinfo=0&autohide=1&color=white&enablejsapi=1&playerapiid=ytplayer&wmode=transparent",
    _domain: "https://www.youtube.com/embed/",
    _players: {},
    className: "quicktube__iframe",
    activeClass: "quicktube--playing",
    pausedClass: "quicktube--paused",
    posterFrameHiddenClass: "quicktube__poster--hidden",
    supportsTransitions: SUPPORTS_TRANSITIONS,
    setExplicitFrameHeight: false,

    init: (options) => {
        const self = this;
        // this.options = this.extend(this.options, options);
        // TODO is this what that extend function is actually trying to do?
        this.options = Object.assign(this.options || {}, options);
        console.log('init');

        const playButton = document.querySelector('[data-quicktube-play]');
        const stopButton = document.querySelector('[data-quicktube-stop]');

        playButton.addEventListener('click', this.onClick.bind(this), false);

        playButton.addEventListener('keydown', (e) => {
            if(e.keyCode == 13) {
                // TODO what do we need to pass to this onclick function
                this.onClick();
                // self.onClick.call(self, $(this));
            }
        }, false);

        stopButton.addEventListener('click', () => {
            const videoId = $(this).data("quicktube-stop");
            this.stopVideo.bind(this, videoId);
        }, false);

        // $("[data-quicktube-play]").on("click", () => {
        //     self.onClick.call(self, $(this));
        // });

        // $("[data-quicktube-play]").on("keydown", (e) => {
        //     if(e.keyCode == 13) {
        //         self.onClick.call(self, $(this));
        //     }
        // });
        // $("[data-quicktube-stop]").on("click", () => {
        //     var videoId = $(this).data("quicktube-stop");
        //     self.stopVideo.call(self, videoId);
        // });
        
        return this;
    },

    /**
     * Deep extend object
     */
    // TODO now redundant if we can use Object.assign or something like that no?
    // will need polyfill https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#Polyfill
    // extend(out) {
    //     var self = this;
    //     out = out || {};
    //     for (var i = 1; i < arguments.length; i++) {
    //         var obj = arguments[i];
    //         if (!obj) {
    //             continue;
    //         }
    //         for (var key in obj) {
    //             if (obj.hasOwnProperty(key)) {
    //                 if (typeof obj[key] === 'object') {
    //                     self.extend(out[key], obj[key]);
    //                 } else {
    //                     out[key] = obj[key];
    //                 }
    //             }
    //         }
    //     }
    //     return out;
    // },

    onClick: (el) => {
        var self = this;
        var parentId = el.data("quicktube-play");
        var $parent = el.closest("[data-quicktube=\"" + parentId + "\"]");
        var $videoContainer = $parent.find("[data-quicktube-video]");
        var $video = $("iframe." + self.className, $videoContainer);
        var videoId = $videoContainer.data("quicktube-video");
        var $poster = $parent.find("[data-quicktube-poster]");

        const onPlayerReady = (e) => {
            if (!isMobileSafari()) {
                if ($parent.data("video-playing")) {
                    self.stopVideo.call(self, parentId);
                } else {
                    $parent.data("video-playing", true);
                   e.target.playVideo();
                }
            }
        };

        // listen for play, pause and end states
        // also report % played every second
        function onPlayerStateChange(e) {
            e["data"] == YT.PlayerState.PLAYING && setTimeout(onPlayerPercent, 1000, e["target"]);
            var video_data = e.target["getVideoData"](),
                label = video_data.title;
            // Get title of the current page
            var pageTitle = document.title;

            if(self.options.trackAnalytics) {
                if (e["data"] == YT.PlayerState.PLAYING && YT.gaLastAction == "p") {
                    label = "Video Played - " + video_data.title;
                    self.trackEvent({
                        'event': 'youtube',
                        'eventCategory': 'Youtube Videos',
                        'eventAction': pageTitle,
                        'eventLabel': label
                    });
                    YT.gaLastAction = "";
                }

                if (e["data"] == YT.PlayerState.PAUSED) {
                    label = "Video Paused - " + video_data.title;
                    self.trackEvent({
                        'event': 'youtube',
                        'eventCategory': 'Youtube Videos',
                        'eventAction': pageTitle,
                        'eventLabel': label
                    });
                    YT.gaLastAction = "p";
                }
            }

            if (e["data"] == YT.PlayerState.ENDED) {
                self.stopVideo.call(self, parentId);
            }
        }

        // catch all to report errors through the GTM data layer
        // once the error is exposed to GTM, it can be tracked in UA as an event!
        const onPlayerError = (e) => {
            if(self.options.trackAnalytics) {
                self.trackEvent({
                    'event': 'error',
                    'eventCategory': 'Youtube Videos',
                    'eventAction': 'GTM',
                    'eventLabel': "youtube:" + e["target"]["src"] + "-" + e["data"]
                })
            };
        };

        // report the % played if it matches 0%, 25%, 50%, 75% or completed
        function onPlayerPercent(e) {
            if (e["getPlayerState"]() == YT.PlayerState.PLAYING) {
                if(self.options.trackAnalytics) {
                    var t = e["getDuration"]() - e["getCurrentTime"]() <= 1.5 ? 1 : (Math.floor(e["getCurrentTime"]() / e["getDuration"]() * 4) / 4).toFixed(2);
                    if (!e["lastP"] || t > e["lastP"]) {
                        var video_data = e["getVideoData"](),
                            label = video_data.title;
                        // Get title of the current page
                        var pageTitle = document.title;
                        e["lastP"] = t;
                        label = t * 100 + "% Video played - " + video_data.title;
                        self.trackEvent({
                            'event': 'youtube',
                            'eventCategory': 'Youtube Videos',
                            'eventAction': pageTitle,
                            'eventLabel': label
                        })
                    }
                    e["lastP"] != 1 && setTimeout(onPlayerPercent, 1000, e);
                }
            }
        }

        if (!$video.length) {
            $video = self.getIframePlayer(videoId, $parent, parentId);
            $videoContainer.html($video);
            this.quicktubePlayer = new YT.Player(parentId, {
                events: {
                    'onStateChange': onPlayerStateChange,
                    'onReady': onPlayerReady,
                    'onError': onPlayerError
                }
            });
            YT.gaLastAction = "p";
        }

        if (!isMobileSafari()) {
            if (this.quicktubePlayer.playVideo) {
                this.quicktubePlayer.playVideo();
            }
        }

        if (self.setExplicitFrameHeight) {
            $video.height($parent.outerHeight());
        }

        if (!$parent.data("video-playing")) {
            self.hidePosterFrame($poster);
            self._players[parentId] = $parent;
            $parent.addClass(self.activeClass).removeClass(self.pausedClass);
            $(window).trigger("quicktube:play", parentId, $parent);
        }
    },

    hidePosterFrame: ($poster) => {
        var self = this;
        $poster.addClass(self.posterFrameHiddenClass);
        if (!self.supportsTransitions) {
            $poster.fadeOut(300);
        }
    },

    showPosterFrame($poster) {
        var self = this;
        $poster.removeClass(self.posterFrameHiddenClass);
        if (!self.supportsTransitions) {
            $poster.fadeIn(300);
        }
    },

    getIframePlayer: (id, parent, parentId) => {
        var self = this;
        var src = self._domain + src + self._settings;
        var iframe = document.createElement("iframe");
        iframe.src = self._domain + id + self._settings;
        iframe.width = "100%";
        iframe.id = parentId;
        iframe.className = this.className;
        return $(iframe);
    },

    stopVideo: (parentId) => {
        var self = this;
        var $parent = $("[data-quicktube=\"" + parentId + "\"]");
        var frame = $parent.find("iframe");
        var func = "pauseVideo";

        if(!this.quicktubePlayer) {
            return;
        }

        this.quicktubePlayer.pauseVideo();
        $parent.removeClass(self.activeClass).addClass(self.pausedClass);
        self.showPosterFrame($parent.find("[data-quicktube-poster]"));
        $parent.data("video-playing", false);
        self._players[parentId] = false;
        $(window).trigger("quicktube:pause", parentId, $parent);
    },

    trackEvent: (event) => {
        if (typeof window._gaq === "object") {
            window._gaq.push(["_trackEvent", event.eventCategory, event.eventAction, event.eventLabel]);
        } else if (typeof window.ga === "function") {
            window.ga('send', 'event', event.eventCategory, event.eventAction, event.eventLabel);
        } else {
        }
    },
};

function quicktubeController(root, factory) {
    // TODO this is all old no idea what's going on
    // need to automatically execute this somewhere?
    
    root.quicktube = factory();
    
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], function () {
            return root.quicktube;
        });
    } else if (typeof module === 'object' && module.exports) {
        // OLD can we rewrite?
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        module.exports = root.quicktube;
    } else {
        // Browser globals
        return root.quicktube;
    }
}

function factory() {
    'use strict';

    // TODO has youtube api improved since this was written in 2015?
    // Mobile Safari exhibits a number of documented bugs with the
    // youtube player API. User agent detection, but you'll live, my boy!
    // https://groups.google.com/forum/#!topic/youtube-api-gdata/vPgKhCu4Vng
    
    let newScriptTag = document.createElement('script');
        newScriptTag.src = "https://www.youtube.com/iframe_api";

    const documentFirstScriptTag = document.getElementsByTagName('script')[0];

    if (documentFirstScriptTag.length > 0) {
        documentFirstScriptTag.parentNode.insertBefore(newScriptTag, documentFirstScriptTag);
    }

    // Export this to window directly.
    window.onYouTubeIframeAPIReady = () => {
        document.addEventListener('DOMContentLoaded', () => {
            Quicktube.init();
        });
    };

    return Quicktube;
}

quicktubeController(ROOT, factory);


// (function (root, factory) {
//     if (typeof define === 'function' && define.amd) {
//         // AMD. Register as an anonymous module.
//         define([], function () {
//             return (root.quicktube = factory());
//         });
//     } else if (typeof module === 'object' && module.exports) {
//         // Node. Does not work with strict CommonJS, but
//         // only CommonJS-like enviroments that support module.exports,
//         // like Node.
//         module.exports = (root.quicktube = factory());
//     } else {
//         // Browser globals
//         root.quicktube = factory();
//     }
// }(typeof global !== 'undefined' ? global : this.window || this.global, function () {
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
//             var $parent = $el.closest("[data-quicktube=\"" + parentId + "\"]");
//             var $videoContainer = $parent.find("[data-quicktube-video]");
//             var $video = $("iframe." + self.className, $videoContainer);
//             var videoId = $videoContainer.data("quicktube-video");
//             var $poster = $parent.find("[data-quicktube-poster]");

//             var onPlayerReady = function(e) {
//                 if (!isMobileSafari()) {
//                     if ($parent.data("video-playing")) {
//                         self.stopVideo.call(self, parentId);
//                     } else {
//                         $parent.data("video-playing", true);
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
//                 $video = self.getIframePlayer(videoId, $parent, parentId);
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
//                 $video.height($parent.outerHeight());
//             }

//             if (!$parent.data("video-playing")) {
//                 self.hidePosterFrame($poster);
//                 self._players[parentId] = $parent;
//                 $parent.addClass(self.activeClass).removeClass(self.pausedClass);
//                 $(window).trigger("quicktube:play", parentId, $parent);
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
//             var $parent = $("[data-quicktube=\"" + parentId + "\"]");
//             var frame = $parent.find("iframe");
//             var func = "pauseVideo";

//             if(!this.quicktubePlayer) {
//                 return;
//             }

//             this.quicktubePlayer.pauseVideo();
//             $parent.removeClass(self.activeClass).addClass(self.pausedClass);
//             self.showPosterFrame($parent.find("[data-quicktube-poster]"));
//             $parent.data("video-playing", false);
//             self._players[parentId] = false;
//             $(window).trigger("quicktube:pause", parentId, $parent);
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

//     return QT;
// }));
