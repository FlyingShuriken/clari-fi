export const TEST_IDS = {
  auth: {
    signInButton: 'auth.sign_in.button',
    verifyCodeButton: 'auth.verify_code.button',
    resendCodeButton: 'auth.resend_code.button',
  },
  account: {
    apiBaseInput: 'account.api_base.input',
    syncBackendButton: 'account.sync_backend.button',
    signOutButton: 'account.sign_out.button',
  },
  capture: {
    transcriptInput: 'capture.transcript.input',
    startListeningButton: 'capture.start_listening.button',
    stopListeningButton: 'capture.stop_listening.button',
    parseVoiceButton: 'capture.parse_voice.button',
    confirmVoiceButton: 'capture.confirm_voice.button',
    receiptCameraButton: 'capture.receipt.camera.button',
    receiptGalleryButton: 'capture.receipt.gallery.button',
    parseReceiptButton: 'capture.parse_receipt.button',
    confirmReceiptButton: 'capture.confirm_receipt.button',
  },
  ledger: {
    refreshButton: 'ledger.refresh.button',
  },
  reports: {
    loadButton: 'reports.load.button',
  },
  prices: {
    itemInput: 'prices.item.input',
    includePromoSwitch: 'prices.include_promo.switch',
    compareButton: 'prices.compare.button',
    historyButton: 'prices.history.button',
    promoCameraButton: 'prices.promo.camera.button',
    promoGalleryButton: 'prices.promo.gallery.button',
    promoIngestButton: 'prices.promo.ingest.button',
    promoListButton: 'prices.promo.list.button',
  },
  alerts: {
    createButton: 'alerts.create.button',
    loadAlertsButton: 'alerts.load.button',
    loadEventsButton: 'alerts.events.load.button',
    markAllReadButton: 'alerts.events.mark_all_read.button',
  },
} as const;
