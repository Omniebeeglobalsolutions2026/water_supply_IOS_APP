import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './App';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // Inject Google Fonts: Plus Jakarta Sans & Inter
  const linkId = 'waterflow-google-fonts';
  if (!document.getElementById(linkId)) {
    const preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnect1);

    const preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect2);

    const fontLink = document.createElement('link');
    fontLink.id = linkId;
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(fontLink);
  }

  const styleId = 'waterflow-premium-styling';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      html, body {
        margin: 0;
        padding: 0;
        background-color: #EDF3F9;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
      /* Smooth font rendering across all elements while preserving icon fonts */
      div, p, span, h1, h2, h3, h4, h5, h6, input, textarea, button, select {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      /* Protect vector icon fonts */
      [style*="font-family: Ionicons"],
      [style*="font-family: 'Ionicons'"],
      [style*="font-family:MaterialIcons"],
      [style*="font-family:FontAwesome"],
      .css-text-146c351[style*="Ionicons"] {
        font-family: Ionicons !important;
      }
      /* Remove default blue outline on web focus */
      input:focus, textarea:focus, button:focus {
        outline: none !important;
      }
      * {
        box-sizing: border-box;
      }
    `;
    document.head.appendChild(style);
  }
}

registerRootComponent(App);
