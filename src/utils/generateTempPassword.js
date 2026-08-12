const WORDS = ["Blue", "Green", "Fast", "Bold", "Gold", "Wave", "Star", "Rock", "Leaf", "Sky"];

export const generateTempPassword = () => {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `Nova${word}${digits}!`;
};