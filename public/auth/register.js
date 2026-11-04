import { createAccount } from "../data/accountData.js";
import { landingFor } from "../data/session.js";

// Wait for DOM to be ready
document.addEventListener("DOMContentLoaded", initializeRegisterPage);

function initializeRegisterPage() {
  // DOM Elements
  const registerForm = document.getElementById("registerForm");
  const usernameInput = document.getElementById("username");
  const displayNameInput = document.getElementById("displayName");
  const emailInput = document.getElementById("email");
  const phoneInput = document.getElementById("phone");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const agreeTermsCheckbox = document.getElementById("agreeTerms");
  const registerBtn = document.getElementById("registerBtn");
  const googleBtn = document.getElementById("googleBtn");
  const passwordToggle = document.getElementById("passwordToggle");
  const confirmPasswordToggle = document.getElementById(
    "confirmPasswordToggle",
  );

  // Password strength elements
  const strengthBars = [
    document.getElementById("bar1"),
    document.getElementById("bar2"),
    document.getElementById("bar3"),
    document.getElementById("bar4"),
  ];
  const strengthText = document.getElementById("strengthText");

  // Error elements
  const usernameError = document.getElementById("usernameError");
  const nameError = document.getElementById("nameError");
  const emailError = document.getElementById("emailError");
  const phoneError = document.getElementById("phoneError");
  const passwordError = document.getElementById("passwordError");
  const confirmPasswordError = document.getElementById("confirmPasswordError");
  const generalError = document.getElementById("generalError");

  // Verify critical DOM elements exist
  if (!registerForm || !usernameInput || !passwordInput || !registerBtn) {
    console.error("Critical form elements not found. Check HTML structure.");
    return;
  }

  const roleInputs = document.querySelectorAll('input[name="role"]');
  const roleOptions = document.querySelectorAll(".userTypeOption");

  roleOptions.forEach((option) => {
    option.addEventListener("click", () => {
      roleOptions.forEach((o) => o.classList.remove("selected"));
      option.classList.add("selected");
    });
  });

  function selectedRole() {
    const picked = [...roleInputs].find((r) => r.checked);
    return picked ? picked.value : "customer";
  }

  function localPhoneNumber(value) {
    return value.replace(/\s/g, "").replace(/^\+65/, "");
  }

  /**
   * Toggle password visibility
   */
  passwordToggle.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    passwordToggle.classList.toggle("visible", isPassword);
  });

  confirmPasswordToggle.addEventListener("click", () => {
    const isPassword = confirmPasswordInput.type === "password";
    confirmPasswordInput.type = isPassword ? "text" : "password";
    confirmPasswordToggle.classList.toggle("visible", isPassword);
  });

  /**
   * Password strength checker
   */
  function checkPasswordStrength(password) {
    let strength = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    Object.values(checks).forEach((passed) => {
      if (passed) strength++;
    });

    return {
      score: strength,
      checks,
    };
  }

  function updatePasswordStrengthUI(password) {
    const { score } = checkPasswordStrength(password);

    // Reset all bars
    strengthBars.forEach((bar) => {
      bar.className = "strengthBar";
    });

    strengthText.className = "strengthText";
    strengthText.textContent = "";

    if (password.length === 0) return;

    const levels = [
      { min: 1, max: 2, class: "weak", text: "Weak" },
      { min: 3, max: 3, class: "fair", text: "Fair" },
      { min: 4, max: 4, class: "good", text: "Good" },
      { min: 5, max: 5, class: "strong", text: "Strong" },
    ];

    const level = levels.find((l) => score >= l.min && score <= l.max);
    if (level) {
      for (let i = 0; i < score && i < 4; i++) {
        strengthBars[i].classList.add(level.class);
      }
      strengthText.classList.add(level.class);
      strengthText.textContent = level.text;
    }
  }

  passwordInput.addEventListener("input", () => {
    updatePasswordStrengthUI(passwordInput.value);
    if (passwordInput.classList.contains("error")) {
      passwordError.classList.remove("visible");
      passwordInput.classList.remove("error");
    }
  });

  /**
   * Clear error messages
   */
  function clearErrors() {
    [
      usernameError,
      nameError,
      emailError,
      phoneError,
      passwordError,
      confirmPasswordError,
      generalError,
    ].forEach((el) => el.classList.remove("visible"));
    [
      usernameInput,
      displayNameInput,
      emailInput,
      phoneInput,
      passwordInput,
      confirmPasswordInput,
    ].forEach((el) => el.classList.remove("error"));
  }

  /**
   * Show error message
   */
  function showError(element, inputElement, message) {
    element.textContent = message;
    element.classList.add("visible");
    if (inputElement) {
      inputElement.classList.add("error");
    }
  }

  /**
   * Validate email format
   */
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number (Singapore format)
   */
  function isValidPhone(phone) {
    if (!phone) return true; // Phone is optional
    const phoneRegex = /^(\+65)?[689]\d{7}$/;
    return phoneRegex.test(phone.replace(/\s/g, ""));
  }

  /**
   * Set loading state
   */
  function setLoading(isLoading) {
    registerBtn.disabled = isLoading;
    registerBtn.classList.toggle("loading", isLoading);
  }

  /**
   * Handle form submission
   */
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    const username = usernameInput.value.trim();
    const displayName = displayNameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const agreeTerms = agreeTermsCheckbox.checked;

    // Validate inputs
    let hasError = false;

    if (!username) {
      showError(usernameError, usernameInput, "Username is required.");
      hasError = true;
    } else if (username.length < 3) {
      showError(
        usernameError,
        usernameInput,
        "Username must be at least 3 characters.",
      );
      hasError = true;
    } else if (username.length > 50) {
      showError(
        usernameError,
        usernameInput,
        "Username must be 50 characters or fewer.",
      );
      hasError = true;
    }

    if (!displayName) {
      showError(nameError, displayNameInput, "Full name is required.");
      hasError = true;
    } else if (displayName.length < 2) {
      showError(
        nameError,
        displayNameInput,
        "Name must be at least 2 characters.",
      );
      hasError = true;
    }

    if (!email) {
      showError(emailError, emailInput, "Email is required.");
      hasError = true;
    } else if (!isValidEmail(email)) {
      showError(emailError, emailInput, "Please enter a valid email address.");
      hasError = true;
    }

    if (phone && !isValidPhone(phone)) {
      showError(
        phoneError,
        phoneInput,
        "Please enter a valid Singapore phone number.",
      );
      hasError = true;
    }

    if (!password) {
      showError(passwordError, passwordInput, "Password is required.");
      hasError = true;
    } else if (password.length < 8) {
      showError(
        passwordError,
        passwordInput,
        "Password must be at least 8 characters.",
      );
      hasError = true;
    } else {
      const { score } = checkPasswordStrength(password);
      if (score < 3) {
        showError(
          passwordError,
          passwordInput,
          "Password is too weak. Add uppercase, numbers, or special characters.",
        );
        hasError = true;
      }
    }

    if (!confirmPassword) {
      showError(
        confirmPasswordError,
        confirmPasswordInput,
        "Please confirm your password.",
      );
      hasError = true;
    } else if (password !== confirmPassword) {
      showError(
        confirmPasswordError,
        confirmPasswordInput,
        "Passwords do not match.",
      );
      hasError = true;
    }

    if (!agreeTerms) {
      showError(
        generalError,
        null,
        "You must agree to the Terms of Service and Privacy Policy.",
      );
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);

    try {
      const user = await createAccount(
        username,
        password,
        email || null,
        selectedRole(),
        phone ? localPhoneNumber(phone) : null,
      );

      const role = user.role || selectedRole();
      window.location.href = role === "customer"
        ? "/consumer/index.html#cuisines"
        : landingFor(role);
    } catch (error) {
      console.error("Registration error:", error);
      if (error.status === 409) {
        showError(usernameError, usernameInput, error.message);
        usernameInput.focus();
      } else if (error.status) {
        showError(generalError, null, error.message);
      } else {
        showError(
          generalError,
          null,
          "Could not reach the server. Please check your connection and try again.",
        );
      }
      setLoading(false);
    }
  });

  /**
   * Handle Google Sign Up
   */
  if (googleBtn) {
    googleBtn.disabled = true;
    googleBtn.setAttribute("aria-disabled", "true");
    googleBtn.title =
      "Google sign-up isn't available yet — use the form above.";
    googleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showError(
        generalError,
        null,
        "Google sign-up isn't available yet. Please use the form above.",
      );
    });
  }

  /**
   * Real-time validation
   */
  displayNameInput.addEventListener("blur", () => {
    const name = displayNameInput.value.trim();
    if (name && name.length < 2) {
      showError(
        nameError,
        displayNameInput,
        "Name must be at least 2 characters.",
      );
    }
  });

  emailInput.addEventListener("blur", () => {
    const email = emailInput.value.trim();
    if (email && !isValidEmail(email)) {
      showError(emailError, emailInput, "Please enter a valid email address.");
    }
  });

  phoneInput.addEventListener("blur", () => {
    const phone = phoneInput.value.trim();
    if (phone && !isValidPhone(phone)) {
      showError(
        phoneError,
        phoneInput,
        "Please enter a valid Singapore phone number.",
      );
    }
  });

  confirmPasswordInput.addEventListener("input", () => {
    if (confirmPasswordInput.classList.contains("error")) {
      confirmPasswordError.classList.remove("visible");
      confirmPasswordInput.classList.remove("error");
    }
  });

  [usernameInput, displayNameInput, emailInput, phoneInput].forEach((input) => {
    input.addEventListener("input", () => {
      if (input.classList.contains("error")) {
        const errorEl = document.getElementById(
          input.id === "displayName" ? "nameError" : input.id + "Error",
        );
        errorEl.classList.remove("visible");
        input.classList.remove("error");
      }
    });
  });
  // Initialize liquid glass top bar
  initLiquidGlassTopBar();
} // End of initializeRegisterPage function

// ============================================
// LIQUID GLASS TOP BAR - DRAGGABLE & BOUNCY
// ============================================

function initLiquidGlassTopBar() {
  const topBar = document.getElementById("authGlassTopBar");
  if (!topBar) return;

  let isDragging = false;
  let startY = 0;
  let startX = 0;
  let currentY = 0;
  let currentX = 0;
  let velocityY = 0;
  let velocityX = 0;
  let lastY = 0;
  let lastX = 0;
  let lastTime = 0;
  let animationFrame = null;

  const maxDragY = 100;
  const maxDragX = 150;
  const springStrength = 0.15;
  const damping = 0.7;

  const updateTransform = () => {
    topBar.style.transform = `translateX(calc(-50% + ${currentX}px)) translateY(${currentY}px) scale(${1 + Math.abs(currentY) * 0.0005})`;
  };

  const startDrag = (e) => {
    if (e.target.closest("button") || e.target.closest("a")) return;

    isDragging = true;
    topBar.classList.add("dragging");

    const clientY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
    const clientX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;

    startY = clientY - currentY;
    startX = clientX - currentX;
    lastY = clientY;
    lastX = clientX;
    lastTime = Date.now();
    velocityY = 0;
    velocityX = 0;

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  };

  const doDrag = (e) => {
    if (!isDragging) return;
    e.preventDefault();

    const clientY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
    const clientX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;

    const now = Date.now();
    const dt = Math.max(now - lastTime, 1);

    velocityY = ((clientY - lastY) / dt) * 10;
    velocityX = ((clientX - lastX) / dt) * 10;

    lastY = clientY;
    lastX = clientX;
    lastTime = now;

    let newY = clientY - startY;
    let newX = clientX - startX;

    if (Math.abs(newY) > maxDragY) {
      const overflow = Math.abs(newY) - maxDragY;
      const resistance = 1 / (1 + overflow * 0.02);
      newY = Math.sign(newY) * (maxDragY + overflow * resistance);
    }

    if (Math.abs(newX) > maxDragX) {
      const overflow = Math.abs(newX) - maxDragX;
      const resistance = 1 / (1 + overflow * 0.02);
      newX = Math.sign(newX) * (maxDragX + overflow * resistance);
    }

    currentY = newY;
    currentX = newX;
    updateTransform();
  };

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    topBar.classList.remove("dragging");
    topBar.classList.add("bouncing");

    const animate = () => {
      const forceY = -currentY * springStrength;
      const forceX = -currentX * springStrength;

      velocityY += forceY;
      velocityX += forceX;

      velocityY *= damping;
      velocityX *= damping;

      currentY += velocityY;
      currentX += velocityX;

      updateTransform();

      if (
        Math.abs(currentY) < 0.5 &&
        Math.abs(velocityY) < 0.1 &&
        Math.abs(currentX) < 0.5 &&
        Math.abs(velocityX) < 0.1
      ) {
        currentY = 0;
        currentX = 0;
        updateTransform();
        topBar.classList.remove("bouncing");
        return;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animate();
  };

  topBar.addEventListener("mousedown", startDrag);
  document.addEventListener("mousemove", doDrag);
  document.addEventListener("mouseup", endDrag);

  topBar.addEventListener("touchstart", startDrag, { passive: false });
  document.addEventListener("touchmove", doDrag, { passive: false });
  document.addEventListener("touchend", endDrag);

  topBar.addEventListener("mouseenter", () => {
    if (!isDragging && currentY === 0 && currentX === 0) {
      currentY = -3;
      updateTransform();
      setTimeout(() => {
        if (!isDragging) {
          topBar.classList.add("bouncing");
          currentY = 0;
          updateTransform();
          setTimeout(() => topBar.classList.remove("bouncing"), 500);
        }
      }, 100);
    }
  });
}
