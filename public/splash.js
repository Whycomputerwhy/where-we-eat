const splash = document.getElementById("splash-screen");

function finishSplash() {
  splash?.remove();

  // Tell the NPC system that the logo animation is finished
  document.dispatchEvent(new Event("splashFinished"));
}

if (splash) {
  setTimeout(() => {
    splash.classList.add("fade-out");

    setTimeout(finishSplash, 800);
  }, 1800);
} else {
  finishSplash();
}
