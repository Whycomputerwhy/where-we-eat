const splash = document.getElementById("splash-screen");

window.addEventListener("load", () => {
  setTimeout(() => {
    splash.classList.add("fade-out");

    setTimeout(() => {
      splash.remove();
    }, 800);

  }, 1800);
});
