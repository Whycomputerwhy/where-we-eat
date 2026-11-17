
const scenes = {
  Start: [
    { speaker: "Spirit", text: "Hey! Wake up! Wake up!" },
    { speaker: "Player", text: "..." },
    { speaker: "Spirit", text: "Oh, thank goodness! You’re awake!" },
    { speaker: "Player", text: "Wait, what?" },

    {
      choices: [
        {
          text: "Who are you?",
          reply: "I’m a food spirit!"
        },
        {
          text: "How did you get into my house?",
          reply: "I didn’t! I’m a food spirit. I was born here!"
        }
      ]
    },

    { speaker: "Spirit", text: "Anyway, the important thing is, you still know how to cook!" },
    { speaker: "Player", text: "Me?" },

    {
      choices: [
        {
          text: "But lots of people know how to cook!",
          reply: "Not anymore!"
        },
        {
          text: "Um, does making instant noodles count...?",
          reply: "That’s good enough!"
        },
        {
          text: "And why does that matter?",
          reply: "Because you’re about to save the world with it!"
        }
      ]
    },

    { speaker: "Spirit", text: "Here, let me catch you up on what happened last night!" }
  ],

  Backstory: [
    { speaker: "Spirit", text: "Okay, so here's what happened last night." },
    { speaker: "Spirit", text: "You know how every dish has a recipe?" },
    { speaker: "Spirit", text: "Well, every recipe has a Food Spirit, too!" },
    { speaker: "Player", text: "Like you?" },
    { speaker: "Spirit", text: "Exactly! I'm the spirit of a dish you remember!" },
    { speaker: "Spirit", text: "But here's the problem..." },
    { speaker: "Spirit", text: "When a recipe is completely forgotten, its Food Spirit turns into a Muncher!" },
    { speaker: "Player", text: "A what?" },
    { speaker: "Spirit", text: "A MUNCHER!" },
    { speaker: "Spirit", text: "And Munchers eat people's memories of food!" },
    { speaker: "Spirit", text: "The more recipes they eat, the more Food Spirits turn into Munchers." },
    { speaker: "Spirit", text: "And when enough Munchers gather together..." },
    { speaker: "Spirit", text: "THEY CREATE A KING MUNCHER!" },
    { speaker: "Player", text: "That doesn't sound good." },
    { speaker: "Spirit", text: "IT'S NOT!" },
    { speaker: "Spirit", text: "One appeared in your city last night!" },
    { speaker: "Spirit", text: "It swallowed thousands of food memories in a single night!" },
    { speaker: "Spirit", text: "That's why almost nobody here remembers how to cook anymore." },
    { speaker: "Player", text: "So why do I still remember?" },
    { speaker: "Spirit", text: "I have NO IDEA!" },
    { speaker: "Spirit", text: "But you remember me, and that's what matters!" },
    { speaker: "Spirit", text: "Quick! Before you forget, write down my recipe!" }
  ]
};

const overlay = document.getElementById("intro-overlay");
const npcName = document.getElementById("npc-name");
const npcText = document.getElementById("npc-text");
const npcImage = document.getElementById("npc-image");
const nextButton = document.getElementById("next-dialogue");

const dialogueContent = document.querySelector(".dialogue-content");
const choicesContainer = document.createElement("div");
choicesContainer.id = "dialogue-choices";
dialogueContent.insertBefore(choicesContainer, nextButton);

let currentScene = "Start";
let currentIndex = 0;
let waitingForReply = false;

function showDialogue() {
  const scene = scenes[currentScene];
  const line = scene[currentIndex];

  choicesContainer.replaceChildren();

  if (line.choices) {
    npcName.textContent = "Player";
    npcText.textContent = "What will you say?";
    nextButton.hidden = true;

    line.choices.forEach(choice => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.text;
      button.className = "choice-button";

      button.addEventListener("click", () => {
        choicesContainer.replaceChildren();
        npcName.textContent = "Spirit";
        npcText.textContent = choice.reply;
        nextButton.hidden = false;
        waitingForReply = true;
      });

      choicesContainer.appendChild(button);
    });

    return;
  }

  waitingForReply = false;
  nextButton.hidden = false;

  npcName.textContent = line.speaker;
  npcText.textContent = line.text;

  // Switch images when introducing Munchers
if (line.text.includes("KING MUNCHER")) {
  npcImage.src = "./king-muncher.png";
} else if (
  line.text.includes("A MUNCHER!") ||
  line.text.includes("turns into a Muncher!")
) {
  npcImage.src = "./muncher.png";
} else {
  npcImage.src = "./food-spirit.png";
}

  const isLastLine =
    currentScene === "Backstory" &&
    currentIndex === scene.length - 1;

  nextButton.textContent = isLastLine ? "Save my recipe!" : "Next →";
}

function closeIntro() {
  overlay.hidden = true;
  localStorage.setItem("whereWeEatIntroSeen", "true");

  const recipeNameInput = document.querySelector(
    'input[name="recipeName"]'
  );

  recipeNameInput?.focus();
}

function nextDialogue() {
  if (waitingForReply) {
    waitingForReply = false;
  }

  currentIndex++;

  if (currentIndex >= scenes[currentScene].length) {
    if (currentScene === "Start") {
      currentScene = "Backstory";
      currentIndex = 0;
    } else {
      closeIntro();
      return;
    }
  }

  showDialogue();
}

nextButton.addEventListener("click", nextDialogue);

function startIntro() {
  if (localStorage.getItem("whereWeEatIntroSeen") !== "true") {
    currentScene = "Start";
    currentIndex = 0;
    overlay.hidden = false;
    showDialogue();
  }
}

document.addEventListener("splashFinished", startIntro);
