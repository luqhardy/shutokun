# Shutokun by Luqman

**Shutokun** is an all-in-one web application for learning Japanese using a Spaced Repetition System (SRS). It supports JLPT vocabulary, kanji, grammar, and kana practice, with cloud sync (Firebase), offline support, and a modern, responsive UI.

## Features

- **Spaced Repetition System (SRS):** Efficiently review vocabulary, kanji, and grammar using proven SRS algorithms.
- **JLPT Levels:** Practice for N5–N1 with curated word, kanji, and grammar lists.
- **Kana Practice:** Interactive hiragana/katakana game with reading/writing/mixed modes.
- **Free Mode:** Import your own vocabulary and track SRS progress.
- **Progress Sync:** Save and sync your progress with Firebase (Google sign-in), or use offline/local mode.
- **Dark Mode:** Toggle between light and dark themes.
- **Mobile Friendly:** Fully responsive design and touch support.
- **Accessibility:** Keyboard shortcuts, ARIA labels, and accessible color schemes.
- **JSON Editor:** Edit or extend your study lists directly in the browser.

## Getting Started

### Online Demo

Visit: [https://luqhardy.github.io/shutokun/](https://luqhardy.github.io/shutokun/)

### Local Development

1. **Clone the repository:**
   ```sh
   git clone https://github.com/luqhardy/shutokun.git
   cd shutokun
   ```
2. **Install dependencies (for build scripts):**
   ```sh
   cd scripts
   npm install
   ```
3. **Run a local server:**
   You can use [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code, or:
   ```sh
   python3 -m http.server 8000
   # or
   npx serve .
   ```
4. **Open in browser:**
   Go to [http://localhost:8000](http://localhost:8000)

### Firebase Setup (Optional)

- The app works offline and with localStorage, but for cloud sync:
  1. Create a Firebase project.
  2. Enable Authentication (Google sign-in) and Realtime Database.
  3. Replace the `firebaseConfig` in `script.js` and `index.html` with your own.
  4. (Optional) Set up Firebase security rules for user data privacy.

## Keyboard Shortcuts

- `Space`: Show answer
- `1`: Mark as "Don't Know"
- `2`: Mark as "Know"
- `D`: Toggle dark mode
- `R`: Reading mode (kana)
- `W`: Writing mode (kana)
- `M`: Mixed mode (kana)

## Project Structure

```
shutokun/
  ├── index.html           # Home page
  ├── srs-ui.html          # SRS study interface
  ├── hirakata.html        # Kana practice game
  ├── free-mode.html       # Free mode for custom vocab
  ├── level-select.html    # JLPT level selection
  ├── about.html           # About page
  ├── how-to-use.html      # Usage instructions
  ├── json-editor.html     # JSON vocab editor
  ├── script.js            # Main app logic
  ├── firebase-db.js       # Firebase DB wrapper
  ├── shutokun-utils.js    # Shared utility functions
  ├── styles.css           # Main stylesheet
  ├── assets/              # Images and icons
  ├── jlpt-db/             # JLPT vocab/kanji/grammar JSON
  └── sw.js                # Service Worker (offline support)
```

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

- Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.
- Keep code modular and well-documented.
- Test on both desktop and mobile browsers.

## License

[MIT](LICENSE)

## Credits

- JLPT data: [https://jlptstudy.net/](https://jlptstudy.net/)
- Built with [Firebase](https://firebase.google.com/), [Inter](https://fonts.google.com/specimen/Inter), [Noto Sans JP](https://fonts.google.com/specimen/Noto+Sans+JP)

---


