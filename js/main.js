gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText);

function initSmoother() {
  if (window.innerWidth > 1000 && typeof ScrollSmoother !== "undefined") {
    ScrollSmoother.create({
      smooth: 2,
      effects: true,
    });
  } else {
    ScrollTrigger.normalizeScroll(true);
  }
  ScrollTrigger.refresh();
}

Promise.all([
  document.fonts ? document.fonts.ready : Promise.resolve(),
  new Promise((resolve) => {
    if (document.readyState === "complete") resolve();
    else window.addEventListener("load", resolve, { once: true });
  }),
]).then(initSmoother);

const larguraTela = window.innerWidth;
window.addEventListener("resize", () => {
  const larguraAtual = window.innerWidth;

  const diferenca = Math.abs(larguraAtual - larguraTela);

  if (diferenca > 300) {
    location.reload();
  }
});

(function () {
  "use strict";

  /* =======================
       PRELOADER
       ======================= */
  const Preloader = {
    el: document.getElementById("preloader"),
    fill: null,
    percentEl: null,
    progress: 0,
    target: 0,
    raf: null,

    init() {
      if (!this.el) return;
      this.fill = this.el.querySelector(".preloader__hammer-fill");
      this.percentEl = this.el.querySelector(".preloader__percent");

      const promises = [];

      // 1. Hero poster image
      const poster = document.querySelector(".hero__poster");
      if (poster) {
        if (poster.complete && poster.naturalWidth > 0) {
          /* already cached */
        } else {
          promises.push(
            new Promise(function (resolve) {
              poster.addEventListener("load", resolve, { once: true });
              poster.addEventListener("error", resolve, { once: true });
            }),
          );
        }
      }

      // 2. Fonts
      if (document.fonts) {
        promises.push(document.fonts.ready);
      }

      // 3. Window load (DOM + sub-resources except lazy ones)
      promises.push(
        new Promise(function (resolve) {
          if (document.readyState === "complete") resolve();
          else window.addEventListener("load", resolve, { once: true });
        }),
      );

      var total = promises.length || 1;
      var loaded = 0;
      var self = this;

      promises.forEach(function (p) {
        p.then(function () {
          loaded++;
          self.target = (loaded / total) * 100;
        });
      });

      // Safety: force-complete after 8 s
      setTimeout(function () {
        self.target = 100;
      }, 8000);

      this.animate();
    },

    animate() {
      var self = this;

      function step() {
        if (self.progress < self.target) {
          self.progress += Math.max(0.5, (self.target - self.progress) * 0.08);
        }

        if (self.progress > 99.5 && self.target >= 100) {
          self.progress = 100;
          self.render();
          setTimeout(function () {
            self.hide();
          }, 400);
          return;
        }

        self.render();
        self.raf = requestAnimationFrame(step);
      }

      self.raf = requestAnimationFrame(step);
    },

    render() {
      var p = Math.round(this.progress);
      if (this.percentEl) this.percentEl.textContent = p + "%";
      if (this.fill) this.fill.style.setProperty("--fill", this.progress + "%");
    },

    hide() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.el.classList.add("loaded");
      document.documentElement.classList.remove("is-loading");

      // Start loading async resources after preloader is done
      HeroVideo.init();
      CtaVideo.init();
      VideoPlayer.init();
      LazyImages.init();
      animarTitulos();
    },
  };

  /* =======================
       HERO VIDEO (background)
       ======================= */
  const HeroVideo = {
    init() {
      var video = document.querySelector(".hero__video");
      if (!video) return;

      var source = video.querySelector("source[data-src]");
      if (!source) return;

      source.src = source.dataset.src;
      source.removeAttribute("data-src");
      video.load();

      video.addEventListener(
        "canplay",
        function () {
          video.classList.add("is-active");
          video.play().catch(function () {
            /* autoplay blocked — poster stays visible */
          });
          ScrollTrigger.refresh();
        },
        { once: true },
      );
    },
  };

  /* =======================
       CTA VIDEO (background)
       ======================= */
  const CtaVideo = {
    init() {
      var video = document.querySelector(".cta__video");
      if (!video) return;

      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              observer.disconnect();
              var source = video.querySelector("source[data-src]");
              if (!source) return;

              source.src = source.dataset.src;
              source.removeAttribute("data-src");
              video.load();

              video.addEventListener(
                "canplay",
                function () {
                  video.classList.add("is-active");
                  video.play().catch(function () {
                    /* autoplay blocked — poster stays visible */
                  });
                  ScrollTrigger.refresh();
                },
                { once: true },
              );
            }
          });
        },
        { rootMargin: "400px" },
      );

      observer.observe(video);
    },
  };

  /* =======================
       VIDEO PLAYER (trailer)
       ======================= */
  const VideoPlayer = {
    init() {
      var container = document.querySelector(".video-player");
      if (!container) return;

      var video = container.querySelector(".video-player__video");
      var overlay = container.querySelector(".video-player__overlay");
      if (!video || !overlay) return;

      var self = this;
      this.video = video;
      this.overlay = overlay;
      this.isPlaying = false;

      // Lazy-load the video source via IntersectionObserver
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              self.loadSource();
              observer.disconnect();
            }
          });
        },
        { rootMargin: "300px" },
      );

      observer.observe(container);

      // Click handler
      var handlePlay = function (e) {
        e.preventDefault();
        e.stopPropagation();
        self.playWithSound();
      };

      overlay.addEventListener("click", handlePlay);

      // Keyboard accessibility
      container.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (self.isPlaying) {
            self.returnToPreview();
          } else {
            self.playWithSound();
          }
        }
      });

      // When video ends, return to muted preview
      video.addEventListener("ended", function () {
        self.returnToPreview();
      });
    },

    loadSource() {
      var source = this.video.querySelector("source[data-src]");
      if (!source) return;

      source.src = source.dataset.src;
      source.removeAttribute("data-src");
      this.video.load();

      var self = this;
      this.video.addEventListener(
        "canplay",
        function () {
          self.video.play().catch(function () {
            /* autoplay muted blocked on some browsers — overlay stays */
          });
        },
        { once: true },
      );
    },

    playWithSound() {
      this.video.currentTime = 0;
      this.video.muted = false;
      this.video.loop = false;
      this.video.setAttribute("controls", "");
      this.video.play().catch(function () {});
      this.overlay.classList.add("is-hidden");
      this.isPlaying = true;
    },

    returnToPreview() {
      this.video.muted = true;
      this.video.loop = true;
      this.video.removeAttribute("controls");
      this.video.play().catch(function () {});
      this.overlay.classList.remove("is-hidden");
      this.isPlaying = false;
    },
  };

  /* =======================
       LAZY IMAGES
       ======================= */
  const LazyImages = {
    init() {
      var images = document.querySelectorAll("img[data-src]");
      if (!images.length) return;

      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var img = entry.target;
              img.src = img.dataset.src;
              img.removeAttribute("data-src");
              img.addEventListener(
                "load",
                function () {
                  img.classList.add("is-loaded");
                },
                { once: true },
              );
              observer.unobserve(img);
            }
          });
        },
        { rootMargin: "400px" },
      );

      images.forEach(function (img) {
        observer.observe(img);
      });
    },
  };

  /* =======================
       SMOOTH SCROLL (nav)
       ======================= */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      var target = document.querySelector(this.getAttribute("href"));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
  // -----------------//
  // TITULOS ANIMADOS //
  // -----------------//
  function animarTitulos() {
    const split = new SplitText("h1", { types: "lines, words, chars" });
    // Cria animação com ScrollTrigger
    gsap.from(split.chars, {
      filter: "blur(18px)",
      opacity: 0,
      duration: 0.6,
      stagger: {
        each: 0.08,
        from: "random",
      },
      scrollTrigger: {
        trigger: "h1",
        start: "top 80%",
        toggleActions: "play none restart none",
      },
    });

    const split2 = new SplitText("h2", { types: "lines, words, chars" });
    // Cria animação com ScrollTrigger
    gsap.from(split2.chars, {
      filter: "blur(18px)",
      opacity: 0,
      duration: 0.3,
      stagger: {
        each: 0.02,
        from: "random",
      },
      scrollTrigger: {
        trigger: "h2",
        start: "top 80%",
        toggleActions: "play none restart none",
      },
    });

    const textosAnimados = document.querySelectorAll(".textoAnimado");
    textosAnimados.forEach((texto) => {
      const split3 = new SplitText(texto, { types: "lines, words, chars" });

      // Cria animação com ScrollTrigger
      gsap.from(split3.chars, {
        filter: "blur(8px)",
        opacity: 0,
        duration: 0.5,
        stagger: {
          each: 0.01,
          from: "random",
        },
        scrollTrigger: {
          trigger: texto,
          start: "top 80%",
          toggleActions: "play none restart none",
        },
      });
    });
  }

  /* =======================
       BOOT
       ======================= */
  Preloader.init();
})();
