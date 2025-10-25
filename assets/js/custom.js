$(function(){$(document).scroll(function(){var $nav=$(".fixed-top");$nav.toggleClass('scrolled',$(this).scrollTop()>$nav.height())})})
// ======== Scroll Animations ========
window.addEventListener("scroll", () => {
  document.querySelectorAll(".fade-up").forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight - 100) {
      el.classList.add("active");
    }
  });
});

// ======== Parallax Effect ========
window.addEventListener("scroll", () => {
  const hero = document.querySelector(".parallax");
  if (hero) {
    const offset = window.scrollY * 0.2;
    hero.style.backgroundPositionY = offset + "px";
  }
});

// ======== Preloader Animation ========
window.addEventListener("load", () => {
  const preloader = document.getElementById("preloader");
  if (preloader) {
    setTimeout(() => {
      preloader.style.opacity = "0";
      preloader.style.transition = "opacity 0.6s ease";
      setTimeout(() => preloader.style.display = "none", 600);
    }, 1000); // durasi tampil preloader
  }
});

// ======== Update tahun footer ========
document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
});
// Fade animation on scroll
window.addEventListener("scroll", () => {
  document.querySelectorAll(".fade-up").forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight - 100) {
      el.classList.add("active");
    }
  });
});

// Parallax background movement
window.addEventListener("scroll", () => {
  const parallax = document.querySelector(".parallax");
  if (parallax) {
    const offset = window.scrollY * 0.3;
    parallax.style.backgroundPositionY = offset + "px";
  }
});
