!function(l) {
    "use strict";
  
    // Sidebar toggle button functionality (for mobile users)
    l("#sidebarToggle, #sidebarToggleTop").on("click", function(e) {
        l("body").toggleClass("sidebar-toggled");
        l(".sidebar").toggleClass("toggled");
    });
  
    // Ensure sidebar remains collapsed on mobile devices
    l(window).resize(function() {
        if (l(window).width() < 480) {
            l("body").addClass("sidebar-toggled");
            l(".sidebar").addClass("toggled");
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