// Banka 3D Secure yönlendirme formlarını kendiliğinden gönderir (CSP satır içi betiğe izin vermez).
document.querySelectorAll("form[data-autosubmit]").forEach((form) => {
  setTimeout(() => form.submit(), 60);
});
