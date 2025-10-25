// Animasi fade-in saat scroll
document.addEventListener("DOMContentLoaded", () => {
  const fadeEls = document.querySelectorAll(".fade-in");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
        }
      });
    },
    { threshold: 0.15 }
  );

  fadeEls.forEach((el) => observer.observe(el));
});

// Efek parallax lembut untuk section hero
window.addEventListener("scroll", () => {
  const parallax = document.querySelector(".parallax");
  if (parallax) {
    const offset = window.pageYOffset;
    parallax.style.backgroundPositionY = offset * 0.4 + "px";
  }
});

// Smooth scroll manual (fallback)
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

// Navbar efek transparan saat scroll
window.addEventListener("scroll", () => {
  const navbar = document.querySelector(".navbar");
  if (navbar) {
    if (window.scrollY > 100) navbar.classList.add("scrolled");
    else navbar.classList.remove("scrolled");
  }
});
