import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Copy text to clipboard with multiple fallback methods
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Whether copy was successful
 */
export async function copyToClipboard(text) {
  // Method 1: Modern Clipboard API
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.log("Clipboard API failed, trying fallback:", err);
    }
  }
  
  // Method 2: Fallback using textarea and execCommand
  const textArea = document.createElement("textarea");
  textArea.value = text;
  
  // Style to make invisible but functional
  Object.assign(textArea.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "2em",
    height: "2em",
    padding: "0",
    border: "none",
    outline: "none",
    boxShadow: "none",
    background: "transparent",
    opacity: "0",
  });
  
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  let success = false;
  try {
    success = document.execCommand('copy');
  } catch (err) {
    console.log("execCommand failed:", err);
  } finally {
    document.body.removeChild(textArea);
  }
  
  return success;
}
