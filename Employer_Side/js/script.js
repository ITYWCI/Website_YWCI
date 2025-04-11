!function(l) {
  "use strict";

  // Sidebar toggle button functionality (for mobile users)
  l("#sidebarToggle, #sidebarToggleTop").on("click", function(e) {
      l("body").toggleClass("sidebar-toggled");
      l(".sidebar").toggleClass("toggled");
  });

  // Sidebar hover effect to expand/collapse (Only on desktops)
  l(".sidebar").hover(
      function() {
          if (l(window).width() >= 768 && !l("body").hasClass("sidebar-toggled-manual")) {
              l("body").removeClass("sidebar-toggled");
              l(this).removeClass("toggled");
          }
      }, 
      function() {
          if (l(window).width() >= 768 && !l("body").hasClass("sidebar-toggled-manual")) {
              l("body").addClass("sidebar-toggled");
              l(this).addClass("toggled");
          }
      }
  );

  // Ensure sidebar remains collapsed on mobile devices
  l(window).resize(function() {
      if (l(window).width() < 480) {
          l("body").addClass("sidebar-toggled");
          l(".sidebar").addClass("toggled");
          l(".sidebar .collapse").collapse("hide");
      }
  });

  // Prevent scrolling inside sidebar on larger screens when using mousewheel
  l("body.fixed-nav .sidebar").on("mousewheel DOMMouseScroll wheel", function(e) {
      if (l(window).width() > 768) {
          var o = e.originalEvent.wheelDelta || -e.originalEvent.detail;
          this.scrollTop += 30 * (o < 0 ? 1 : -1);
          e.preventDefault();
      }
  });

  // To unactivate the settings link after click

  // Show "scroll to top" button on scroll
  l(window).on("scroll", function() {
    var scrollDistance = l(this).scrollTop();
    
    // Show button after 100px of scrolling
    if (scrollDistance > 100) {
        l('.scroll-to-top').fadeIn();
    } else {
        l('.scroll-to-top').fadeOut();
    }
});

// Smooth scroll for "scroll to top" button
l(document).on("click", "a.scroll-to-top", function(e) {
    e.preventDefault();
    l("html, body").animate({
        scrollTop: 0
    }, 1000, "easeInOutExpo");
});

}(jQuery);