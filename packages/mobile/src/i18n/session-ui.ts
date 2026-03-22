import type { SupportedLocale } from '@japanese-learn/shared';

export interface SessionUiCopy {
  loading: string;
  completeBadge: string;
  completeTitle: string;
  completeSubtitle: (count: number) => string;
  restartSession: string;
  backHome: string;
  breakBadge: string;
  breakTitle: string;
  breakSubtitle: (count: number, minutes: number) => string;
  continueLabel: string;
  progressA11y: (current: number, total: number) => string;
  shortSessionMode: string;
  strictSurfaceMode: string;
  drillLabel: string;
  newLabel: string;
  reviewLabel: string;
  audioLabel: string;
  audioPromptTitle: string;
  playAudio: string;
  playingAudio: string;
  playAudioA11y: string;
  audioSource: (source: string) => string;
  showTranslationAfterFeedback: string;
  correct: string;
  incorrect: string;
  answerPrefix: string;
  translationPrefix: string;
  nextReview: (dateLabel: string) => string;
  nextCard: string;
  nextCardA11y: string;
  choiceA11y: (choice: string) => string;
  selectedChoice: (choice: string) => string;
  listeningPlaceholder: string;
  exactSurfacePlaceholder: string;
  answerPlaceholder: string;
  submit: string;
  submitA11y: string;
  replayAudio: string;
  replayAudioA11y: string;
  showHint: (index: number, total: number) => string;
  promptMeaning: string;
  promptReading: string;
  promptSurface: string;
  promptExactSurface: string;
  promptChoose: string;
  promptCloze: string;
  promptListening: string;
  promptDefault: string;
  listenBeforeAnswer: string;
  hintPrefix: string;
  enterAnswerHint: string;
  loadErrorTitle: string;
  loadErrorBody: string;
  audioErrorTitle: string;
  audioErrorBody: string;
}

const SESSION_UI_COPY: Record<SupportedLocale, SessionUiCopy> = {
  ko: {
    loading: '\uC624\uB298 \uC138\uC158\uC744 \uBD88\uB7EC\uC624\uB294 \uC911...',
    completeBadge: '\uC644\uB8CC',
    completeTitle: '\uC138\uC158 \uC644\uB8CC',
    completeSubtitle: (count) => `\uC624\uB298 ${count}\uC7A5\uC758 \uCE74\uB4DC\uB97C \uBCF5\uC2B5\uD588\uC2B5\uB2C8\uB2E4.\n\uB2E4\uC74C \uB300\uAE30\uC5F4\uC740 \uB0B4\uC77C \uB2E4\uC2DC \uD655\uC778\uD558\uC138\uC694.`,
    restartSession: '\uC138\uC158 \uB2E4\uC2DC \uC2DC\uC791',
    backHome: '\uD648\uC73C\uB85C',
    breakBadge: '\uD734\uC2DD',
    breakTitle: '\uC9E7\uAC8C \uC26C\uC5B4\uAC00\uC138\uC694',
    breakSubtitle: (count, minutes) => `${count}\uC7A5\uC744 \uD50C\uC5C8\uC2B5\uB2C8\uB2E4.\n\uD53C\uB85C\uB97C \uC904\uC774\uAE30 \uC704\uD574 ${minutes}\uBD84 \uB2E8\uC704\uB85C \uC7A0\uC2DC \uBA48\uCD65\uB2C8\uB2E4.`,
    continueLabel: '\uACC4\uC18D',
    progressA11y: (current, total) => `\uBB38\uD56D ${current}/${total}`,
    shortSessionMode: '\uD53C\uB85C \uAC10\uC18C\uB97C \uC704\uD574 \uC9E7\uC740 \uC138\uC158 \uBAA8\uB4DC\uAC00 \uD65C\uC131\uD654\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.',
    strictSurfaceMode: '\uC0DD\uC131 \uBB38\uD56D\uC5D0\uC11C \uC5C4\uACA9\uD55C \uD45C\uAE30 \uCC44\uC810\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4.',
    drillLabel: '\uC624\uB958 \uB4DC\uB9B4',
    newLabel: '\uC2E0\uADDC',
    reviewLabel: '\uBCF5\uC2B5',
    audioLabel: '\uC624\uB514\uC624',
    audioPromptTitle: '\uB4E3\uACE0 \uB2F5\uC744 \uC785\uB825\uD558\uC138\uC694',
    playAudio: '\uC624\uB514\uC624 \uC7AC\uC0DD',
    playingAudio: '\uC7AC\uC0DD \uC911...',
    playAudioA11y: '\uC77C\uBCF8\uC5B4 \uC624\uB514\uC624 \uC7AC\uC0DD',
    audioSource: (source) => `\uC18C\uC2A4: ${source}`,
    showTranslationAfterFeedback: '\uBC88\uC5ED\uC740 \uD53C\uB4DC\uBC31 \uD6C4\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4.',
    correct: '\uC815\uB2F5',
    incorrect: '\uC624\uB2F5',
    answerPrefix: '\uC815\uB2F5',
    translationPrefix: '\uBC88\uC5ED',
    nextReview: (dateLabel) => `\uB2E4\uC74C \uBCF5\uC2B5: ${dateLabel}`,
    nextCard: '\uB2E4\uC74C \uCE74\uB4DC',
    nextCardA11y: '\uB2E4\uC74C \uCE74\uB4DC\uB85C \uC774\uB3D9',
    choiceA11y: (choice) => `\uC120\uD0DD\uC9C0 ${choice}`,
    selectedChoice: (choice) => `\uC120\uD0DD: ${choice}`,
    listeningPlaceholder: '\uB2E8\uC5B4\uB97C \uC785\uB825\uD558\uC138\uC694...',
    exactSurfacePlaceholder: '\uC815\uD655\uD55C \uD45C\uAE30\uB97C \uC785\uB825\uD558\uC138\uC694...',
    answerPlaceholder: '\uB2F5\uC744 \uC785\uB825\uD558\uC138\uC694...',
    submit: '\uC81C\uCD9C',
    submitA11y: '\uB2F5 \uC81C\uCD9C',
    replayAudio: '\uC624\uB514\uC624 \uB2E4\uC2DC \uC7AC\uC0DD',
    replayAudioA11y: '\uC624\uB514\uC624 \uB2E4\uC2DC \uC7AC\uC0DD',
    showHint: (index, total) => `\uD78C\uD2B8 \uBCF4\uAE30 (${index}/${total})`,
    promptMeaning: '\uD45C\uAE30\uAC00 \uAC00\uB9AC\uD0A4\uB294 \uB73B\uC744 \uC785\uB825\uD558\uC138\uC694.',
    promptReading: '\uB85C\uB9C8\uC790 \uC77D\uAE30\uB97C \uC785\uB825\uD558\uC138\uC694.',
    promptSurface: '\uC77C\uBCF8\uC5B4 \uD45C\uAE30\uB97C \uC785\uB825\uD558\uC138\uC694.',
    promptExactSurface: '\uC815\uD655\uD55C \uC77C\uBCF8\uC5B4 \uD45C\uAE30\uB97C \uC785\uB825\uD558\uC138\uC694.',
    promptChoose: '\uB9DE\uB294 \uC77C\uBCF8\uC5B4 \uB2E8\uC5B4\uB97C \uACE0\uB974\uC138\uC694.',
    promptCloze: '\uBE48\uCE78\uC5D0 \uB4E4\uC5B4\uAC08 \uB2E8\uC5B4\uB97C \uC785\uB825\uD558\uC138\uC694.',
    promptListening: '\uC624\uB514\uC624\uB97C \uB4E3\uACE0 \uC77C\uBCF8\uC5B4 \uB2E8\uC5B4\uB97C \uC785\uB825\uD558\uC138\uC694.',
    promptDefault: '\uB2F5\uC744 \uC785\uB825\uD558\uC138\uC694.',
    listenBeforeAnswer: '\uB2F5\uBCC0 \uC804\uC5D0 \uC624\uB514\uC624\uB97C \uB4E3\uC138\uC694.',
    hintPrefix: '\uD78C\uD2B8',
    enterAnswerHint: '\uB2F5\uC744 \uC785\uB825\uD55C \uB4A4 \uC81C\uCD9C\uD558\uC138\uC694',
    loadErrorTitle: '\uC624\uB958',
    loadErrorBody: '\uC624\uB298 \uC138\uC158\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.',
    audioErrorTitle: '\uC624\uB958',
    audioErrorBody: '\uC624\uB514\uC624\uB97C \uC7AC\uC0DD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.',
  },
  en: {
    loading: 'Loading today\'s session...',
    completeBadge: 'Done',
    completeTitle: 'Session complete',
    completeSubtitle: (count) => `You reviewed ${count} cards today.\nCome back tomorrow for the next queue.`,
    restartSession: 'Restart session',
    backHome: 'Back to home',
    breakBadge: 'Break',
    breakTitle: 'Take a short break',
    breakSubtitle: (count, minutes) => `You completed ${count} cards.\nThis session pauses every ${minutes} minutes to reduce fatigue.`,
    continueLabel: 'Continue',
    progressA11y: (current, total) => `Question ${current} of ${total}`,
    shortSessionMode: 'Short session mode is active to reduce fatigue.',
    strictSurfaceMode: 'Strict surface grading is active for production prompts.',
    drillLabel: 'Error drill',
    newLabel: 'New',
    reviewLabel: 'Review',
    audioLabel: 'Audio',
    audioPromptTitle: 'Listen and enter the answer',
    playAudio: 'Play audio',
    playingAudio: 'Playing...',
    playAudioA11y: 'Play Japanese audio',
    audioSource: (source) => `Source: ${source}`,
    showTranslationAfterFeedback: 'Translation is shown after feedback.',
    correct: 'Correct',
    incorrect: 'Incorrect',
    answerPrefix: 'Answer',
    translationPrefix: 'Translation',
    nextReview: (dateLabel) => `Next review: ${dateLabel}`,
    nextCard: 'Next card',
    nextCardA11y: 'Go to next card',
    choiceA11y: (choice) => `Choice ${choice}`,
    selectedChoice: (choice) => `Selected: ${choice}`,
    listeningPlaceholder: 'Type the word...',
    exactSurfacePlaceholder: 'Type the exact surface...',
    answerPlaceholder: 'Type your answer...',
    submit: 'Submit',
    submitA11y: 'Submit answer',
    replayAudio: 'Replay audio',
    replayAudioA11y: 'Replay audio',
    showHint: (index, total) => `Show hint (${index}/${total})`,
    promptMeaning: 'Type the meaning shown by the surface.',
    promptReading: 'Type the reading in romaji.',
    promptSurface: 'Type the Japanese surface.',
    promptExactSurface: 'Type the exact Japanese surface.',
    promptChoose: 'Choose the Japanese word that matches.',
    promptCloze: 'Fill in the missing word.',
    promptListening: 'Listen to the audio and type the Japanese word.',
    promptDefault: 'Type your answer.',
    listenBeforeAnswer: 'Listen to the audio before answering.',
    hintPrefix: 'Hint',
    enterAnswerHint: 'Enter your answer and submit',
    loadErrorTitle: 'Error',
    loadErrorBody: 'Failed to load today\'s session.',
    audioErrorTitle: 'Error',
    audioErrorBody: 'Could not play audio.',
  },
  ja: {
    loading: '\u4ECA\u65E5\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D...',
    completeBadge: '\u5B8C\u4E86',
    completeTitle: '\u30BB\u30C3\u30B7\u30E7\u30F3\u5B8C\u4E86',
    completeSubtitle: (count) => `\u4ECA\u65E5\u306F${count}\u679A\u306E\u30AB\u30FC\u30C9\u3092\u5FA9\u7FD2\u3057\u307E\u3057\u305F\u3002\n\u6B21\u306E\u30AD\u30E5\u30FC\u306F\u660E\u65E5\u307E\u305F\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002`,
    restartSession: '\u30BB\u30C3\u30B7\u30E7\u30F3\u3092\u3084\u308A\u76F4\u3059',
    backHome: '\u30DB\u30FC\u30E0\u3078',
    breakBadge: '\u4F11\u61A9',
    breakTitle: '\u77ED\u304F\u4F11\u61A9\u3057\u307E\u3057\u3087\u3046',
    breakSubtitle: (count, minutes) => `${count}\u679A\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002\n\u75B2\u52B4\u3092\u6291\u3048\u308B\u305F\u3081${minutes}\u5206\u3054\u3068\u306B\u4E00\u6642\u505C\u6B62\u3057\u307E\u3059\u3002`,
    continueLabel: '\u7D9A\u3051\u308B',
    progressA11y: (current, total) => `\u554F\u984C ${current}/${total}`,
    shortSessionMode: '\u75B2\u52B4\u3092\u6291\u3048\u308B\u305F\u3081\u306E\u77ED\u3044\u30BB\u30C3\u30B7\u30E7\u30F3\u30E2\u30FC\u30C9\u304C\u6709\u52B9\u3067\u3059\u3002',
    strictSurfaceMode: '\u751F\u6210\u554F\u984C\u3067\u306F\u8868\u8A18\u306E\u53B3\u683C\u63A1\u70B9\u304C\u6709\u52B9\u3067\u3059\u3002',
    drillLabel: '\u8AA4\u308A\u30C9\u30EA\u30EB',
    newLabel: '\u65B0\u898F',
    reviewLabel: '\u5FA9\u7FD2',
    audioLabel: '\u97F3\u58F0',
    audioPromptTitle: '\u97F3\u58F0\u3092\u805E\u3044\u3066\u7B54\u3048\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044',
    playAudio: '\u97F3\u58F0\u3092\u518D\u751F',
    playingAudio: '\u518D\u751F\u4E2D...',
    playAudioA11y: '\u65E5\u672C\u8A9E\u97F3\u58F0\u3092\u518D\u751F',
    audioSource: (source) => `\u30BD\u30FC\u30B9: ${source}`,
    showTranslationAfterFeedback: '\u8A33\u306F\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u5F8C\u306B\u8868\u793A\u3055\u308C\u307E\u3059\u3002',
    correct: '\u6B63\u89E3',
    incorrect: '\u4E0D\u6B63\u89E3',
    answerPrefix: '\u6B63\u89E3',
    translationPrefix: '\u8A33',
    nextReview: (dateLabel) => `\u6B21\u306E\u5FA9\u7FD2: ${dateLabel}`,
    nextCard: '\u6B21\u306E\u30AB\u30FC\u30C9',
    nextCardA11y: '\u6B21\u306E\u30AB\u30FC\u30C9\u3078\u79FB\u52D5',
    choiceA11y: (choice) => `\u9078\u629E\u80A2 ${choice}`,
    selectedChoice: (choice) => `\u9078\u629E\u4E2D: ${choice}`,
    listeningPlaceholder: '\u5358\u8A9E\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044...',
    exactSurfacePlaceholder: '\u6B63\u78BA\u306A\u8868\u8A18\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044...',
    answerPlaceholder: '\u7B54\u3048\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044...',
    submit: '\u63D0\u51FA',
    submitA11y: '\u7B54\u3048\u3092\u63D0\u51FA',
    replayAudio: '\u97F3\u58F0\u3092\u3082\u3046\u4E00\u5EA6\u518D\u751F',
    replayAudioA11y: '\u97F3\u58F0\u3092\u3082\u3046\u4E00\u5EA6\u518D\u751F',
    showHint: (index, total) => `\u30D2\u30F3\u30C8\u3092\u8868\u793A (${index}/${total})`,
    promptMeaning: '\u8868\u8A18\u304C\u793A\u3059\u610F\u5473\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    promptReading: '\u30ED\u30FC\u30DE\u5B57\u306E\u8AAD\u307F\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    promptSurface: '\u65E5\u672C\u8A9E\u306E\u8868\u8A18\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    promptExactSurface: '\u6B63\u78BA\u306A\u65E5\u672C\u8A9E\u306E\u8868\u8A18\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    promptChoose: '\u5408\u3046\u65E5\u672C\u8A9E\u306E\u5358\u8A9E\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002',
    promptCloze: '\u7A74\u57CB\u3081\u306B\u5165\u308B\u5358\u8A9E\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    promptListening: '\u97F3\u58F0\u3092\u805E\u3044\u3066\u65E5\u672C\u8A9E\u306E\u5358\u8A9E\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    promptDefault: '\u7B54\u3048\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    listenBeforeAnswer: '\u56DE\u7B54\u524D\u306B\u97F3\u58F0\u3092\u805E\u3044\u3066\u304F\u3060\u3055\u3044\u3002',
    hintPrefix: '\u30D2\u30F3\u30C8',
    enterAnswerHint: '\u7B54\u3048\u3092\u5165\u529B\u3057\u3066\u63D0\u51FA\u3057\u3066\u304F\u3060\u3055\u3044',
    loadErrorTitle: '\u30A8\u30E9\u30FC',
    loadErrorBody: '\u4ECA\u65E5\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002',
    audioErrorTitle: '\u30A8\u30E9\u30FC',
    audioErrorBody: '\u97F3\u58F0\u3092\u518D\u751F\u3067\u304D\u307E\u305B\u3093\u3002',
  },
};

export function getSessionUiCopy(locale: SupportedLocale): SessionUiCopy {
  return SESSION_UI_COPY[locale];
}
