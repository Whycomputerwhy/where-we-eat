const splash = document.getElementById("splash-screen");

if (splash) {
  console.log("Splash screen found!");

  setTimeout(() => {
    console.log("Starting fade out...");

    splash.classList.add("fade-out");

    setTimeout(() => {
      splash.remove();
      console.log("Splash screen removed!");
    }, 800);

  }, 1800);
}
