// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppL10nEn extends AppL10n {
  AppL10nEn([String locale = 'en']) : super(locale);

  @override
  String get commonSave => 'Save';

  @override
  String get commonCancel => 'Cancel';

  @override
  String get commonDelete => 'Delete';

  @override
  String get commonLoading => 'Loading...';

  @override
  String get commonLoadFailed => 'Failed to load';

  @override
  String get commonToday => 'Today';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get settingsAccountSection => 'Account';

  @override
  String get settingsAccountUnnamed => 'Unnamed';

  @override
  String settingsAccountJoinedAt(Object date) {
    return 'Joined $date';
  }

  @override
  String get settingsThemeSection => 'Theme';

  @override
  String get settingsThemeLight => 'Light';

  @override
  String get settingsThemeDark => 'Dark';

  @override
  String get settingsThemeSystem => 'System';

  @override
  String get settingsAppearanceSection => 'Appearance';

  @override
  String get settingsAppearancePaperLabel => 'Paper texture';

  @override
  String get settingsAppearancePaperDesc =>
      'Subtle paper grain on the background';

  @override
  String get settingsLanguageSection => 'Language';

  @override
  String get settingsLanguageZhTW => '繁中';

  @override
  String get settingsLanguageEn => 'EN';

  @override
  String get settingsLanguageJa => '日本語';

  @override
  String get settingsLanguageAuto => 'Auto';

  @override
  String get settingsLanguageUpdateFailed =>
      'Couldn\'t change language. Try again later.';

  @override
  String get settingsTagsSection => 'Tags';

  @override
  String get settingsCleanUntitledLabel => 'Clean up empty cards';

  @override
  String get settingsCleanUntitledLabelLoading => 'Cleaning…';

  @override
  String get settingsCleanUntitledConfirmTitle => 'Clean up empty cards';

  @override
  String get settingsCleanUntitledConfirmBody =>
      'This deletes every untitled card. Are you sure?';

  @override
  String get settingsCleanUntitledConfirmOk => 'Delete';

  @override
  String settingsCleanUntitledSuccessWithCount(Object count) {
    return 'Cleaned $count empty card(s)';
  }

  @override
  String get settingsCleanUntitledSuccessEmpty => 'Nothing to clean';

  @override
  String get settingsCleanUntitledFailed => 'Clean up failed';

  @override
  String get settingsLogoutButton => 'Log out';

  @override
  String get settingsLogoutConfirmTitle => 'Log out';

  @override
  String get settingsLogoutConfirmBody => 'Log out now?';

  @override
  String get tagsAdd => 'Add';

  @override
  String get tagsAddTag => 'Add tag';

  @override
  String get tagsAddTagShort => 'Add tag';

  @override
  String get tagsChangeColor => 'Color';

  @override
  String get tagsCreate => 'Create';

  @override
  String tagsCreateNamed(Object name) {
    return 'Create \"$name\"';
  }

  @override
  String get tagsDeleteTitle => 'Delete tag';

  @override
  String tagsDeleteConfirm(Object name) {
    return 'Delete \"$name\"?';
  }

  @override
  String tagsDeleteTagAria(Object name) {
    return 'Delete $name';
  }

  @override
  String get tagsNewTagPlaceholder => 'New tag...';

  @override
  String tagsRemoveAria(Object name) {
    return 'Remove $name';
  }

  @override
  String get tagsSearchOrCreate => 'Search or create tag...';

  @override
  String get navTasks => 'Tasks';

  @override
  String get navNotes => 'Notes';

  @override
  String get navCards => 'Cards';

  @override
  String get navSettings => 'Settings';

  @override
  String get navMainNavAria => 'Main navigation';

  @override
  String get navSettingsAria => 'Open settings';

  @override
  String get loginTagline => 'A lightweight nudge for your daily tasks';

  @override
  String get loginSignInWithGoogle => 'Sign in with Google';

  @override
  String get loginLoginFailed => 'Sign-in failed. Please try again.';

  @override
  String taskDragReorder(Object title) {
    return 'Drag to reorder: $title';
  }

  @override
  String taskCheckboxAria(Object title, Object state) {
    return '$title: $state';
  }

  @override
  String get taskStateCompleted => 'Completed';

  @override
  String get taskStateIncomplete => 'Not completed';

  @override
  String get taskEditTitleAria => 'Edit task title';

  @override
  String taskExpandContentAria(Object title) {
    return 'Expand content of \"$title\"';
  }

  @override
  String get taskDetailExpandPage => 'Expand to full page';

  @override
  String get taskDetailClose => 'Close';

  @override
  String get taskDetailContentPlaceholder => 'Write content...';

  @override
  String get taskCreatePlaceholder => 'Add a task';

  @override
  String get taskMoveToOtherDay => 'Move to another day';

  @override
  String get taskViewDetails => 'View details';

  @override
  String get taskComplete => 'Complete task';

  @override
  String get taskUncomplete => 'Mark as incomplete';

  @override
  String get taskMoveToOtherDate => 'Move to another date';

  @override
  String get editorDragBlockAria => 'Drag block';

  @override
  String get editorDragBlockTitle => 'Drag to reorder';

  @override
  String get editorCodeLangAria => 'Switch language';

  @override
  String get editorCodeCopyAria => 'Copy';

  @override
  String get editorCodeCopiedAria => 'Copied';

  @override
  String get editorCodeCopyTitle => 'Copy code';

  @override
  String get editorSlashNoResults => 'No matching items';

  @override
  String get editorSlashTextLabel => 'Text';

  @override
  String get editorSlashTextDescription => 'Plain paragraph text';

  @override
  String get editorSlashTextKeywords => 'text|paragraph|body|plain';

  @override
  String get editorSlashH1Label => 'Heading 1';

  @override
  String get editorSlashH1Description => 'Large section heading';

  @override
  String get editorSlashH1Keywords => 'h1|head|heading|large|title';

  @override
  String get editorSlashH2Label => 'Heading 2';

  @override
  String get editorSlashH2Description => 'Medium section heading';

  @override
  String get editorSlashH2Keywords => 'h2|head|heading|medium';

  @override
  String get editorSlashH3Label => 'Heading 3';

  @override
  String get editorSlashH3Description => 'Small section heading';

  @override
  String get editorSlashH3Keywords => 'h3|head|heading|small';

  @override
  String get editorSlashBulletLabel => 'Bullet list';

  @override
  String get editorSlashBulletDescription => 'Create an unordered list';

  @override
  String get editorSlashBulletKeywords => 'list|bullet|ul|unordered';

  @override
  String get editorSlashOrderedLabel => 'Numbered list';

  @override
  String get editorSlashOrderedDescription => 'Create a numbered list';

  @override
  String get editorSlashOrderedKeywords => 'ol|number|ordered|list';

  @override
  String get editorSlashTodoLabel => 'To-do list';

  @override
  String get editorSlashTodoDescription => 'Checklist with checkboxes';

  @override
  String get editorSlashTodoKeywords => 'todo|task|check|checklist';

  @override
  String get editorSlashQuoteLabel => 'Quote';

  @override
  String get editorSlashQuoteDescription => 'Blockquote';

  @override
  String get editorSlashQuoteKeywords => 'quote|blockquote|cite';

  @override
  String get editorSlashCodeLabel => 'Code block';

  @override
  String get editorSlashCodeDescription =>
      'Code block with syntax highlighting';

  @override
  String get editorSlashCodeKeywords => 'code|block|pre|syntax';

  @override
  String get editorSlashDividerLabel => 'Divider';

  @override
  String get editorSlashDividerDescription => 'Horizontal divider line';

  @override
  String get editorSlashDividerKeywords => 'hr|divider|separator|line';

  @override
  String get dailyEmptyToday => 'No tasks for today';

  @override
  String get dailyOverdueSectionAria => 'Tasks from previous days';

  @override
  String dailyOverdueLabel(Object count) {
    return 'From earlier ($count)';
  }

  @override
  String get dailyOverdueScheduleToday => 'Move to today';

  @override
  String dailyOverdueOriginalDateAria(Object date) {
    return 'Original date: $date';
  }

  @override
  String dailyOverdueArchiveAria(Object title) {
    return 'Archive task: $title';
  }

  @override
  String dailyOverdueIncompleteAria(Object title) {
    return '$title: not completed';
  }

  @override
  String get dailyArchiveTitle => 'Archive task';

  @override
  String dailyArchiveConfirmBody(Object title) {
    return 'Archive \"$title\"? Archived tasks will not appear in your task list.';
  }

  @override
  String get dailyArchiveButton => 'Archive';

  @override
  String get dailyCalendarNavAria => 'Weekly calendar';

  @override
  String get dailyPrevWeekAria => 'Previous week';

  @override
  String get dailyNextWeekAria => 'Next week';

  @override
  String dailyDateAria(Object month, Object day, Object weekday) {
    return '$month/$day $weekday';
  }

  @override
  String get dailyTodayButton => 'Today';

  @override
  String get cardsCreateAria => 'New card';

  @override
  String get cardsCleanUntitledAria => 'Clean untitled cards';

  @override
  String get cardsViewListAria => 'List view';

  @override
  String get cardsViewGridAria => 'Grid view';

  @override
  String get cardsSearchPlaceholder => 'Search cards...';

  @override
  String get cardsSearchAria => 'Search cards';

  @override
  String get cardsEmptyWithQuery => 'No matching cards';

  @override
  String get cardsEmptyNoCards => 'No cards with content yet';

  @override
  String get cardsEmptyMobile => 'No cards yet';

  @override
  String get cardsLoadMore => 'Loading more...';

  @override
  String get cardsNoMore => 'No more cards';

  @override
  String get cardsCleanDialogTitle => 'Clean untitled cards';

  @override
  String get cardsCleanDialogBody =>
      'This will delete all cards without a title. This action cannot be undone.';

  @override
  String get cardsCleanConfirmButton => 'Confirm delete';

  @override
  String get cardsCleanLoading => 'Cleaning...';

  @override
  String cardsToastCleaned(Object count) {
    return 'Cleaned $count untitled card(s)';
  }

  @override
  String get cardsToastNothingToClean => 'No cards to clean';

  @override
  String get cardDetailBackToCards => 'Back to cards';

  @override
  String get cardDetailNotFound => 'Card not found';

  @override
  String get cardDetailEditTitleAria => 'Edit title';

  @override
  String get cardDetailEditorPlaceholder => 'Type / to insert headings, lists…';

  @override
  String get cardDetailTitleHint => 'Title';

  @override
  String cardDetailCreatedAt(Object date) {
    return 'Created $date';
  }

  @override
  String cardDetailUpdatedAt(Object date) {
    return 'Updated $date';
  }

  @override
  String get notesBackToCanvasAria => 'Back to today\'s canvas';

  @override
  String get notesBackToCanvasTitle => 'Back to today';

  @override
  String get notesEmptyFeedPrompt =>
      'No past journal entries yet. Start writing from today.';

  @override
  String get notesEmptyFeedShort => 'No past journal entries yet';

  @override
  String get notesGoToCanvas => 'Go to today\'s canvas';

  @override
  String get notesGoToToday => 'Go to today\'s journal';

  @override
  String get notesNoMoreEntries => 'No more entries';

  @override
  String get notesCanvasPlaceholder => 'Write something...';

  @override
  String get notesCanvasToggleFeedAria => 'Switch to feed';

  @override
  String get notesCanvasToggleFeedTitle => 'Switch to feed';

  @override
  String notesEntryAria(Object year, Object month, Object day) {
    return 'Journal for $month/$day/$year';
  }

  @override
  String notesMonthLabel(Object month) {
    return '$month';
  }

  @override
  String get calendarSection => 'Calendar';

  @override
  String get calendarConnectTitle => 'Connect Google Calendar';

  @override
  String get calendarConnectDescription => 'See your meetings for today';

  @override
  String get calendarConnectButton => 'Connect';

  @override
  String get calendarDisconnectButton => 'Disconnect';

  @override
  String get calendarDisconnectConfirmTitle => 'Disconnect';

  @override
  String get calendarDisconnectConfirmBody =>
      'Disconnect from Google Calendar?';

  @override
  String calendarConnectedAs(Object email) {
    return 'Connected as $email';
  }

  @override
  String get calendarSubCalendars => 'Calendars to show';

  @override
  String get calendarPanelTitle => 'Today';

  @override
  String get calendarPanelEmpty => 'Nothing scheduled today';

  @override
  String get calendarPanelLoading => 'Loading…';

  @override
  String get calendarPanelError => 'Couldn\'t load calendar';

  @override
  String get calendarPanelRetry => 'Retry';

  @override
  String get calendarPanelReauth => 'Authorization expired, reconnect';

  @override
  String get calendarPanelRefresh => 'Refresh';

  @override
  String get calendarEventAllDay => 'All day';

  @override
  String get calendarEventBusy => 'Busy';

  @override
  String get calendarEventLocation => 'Location';

  @override
  String get calendarEventAttendees => 'Attendees';

  @override
  String get calendarEventDescription => 'Description';

  @override
  String get calendarEventOpenInGoogle => 'Open in Google Calendar';

  @override
  String calendarMobileCollapsedCount(Object count) {
    return 'Today · $count events';
  }

  @override
  String get calendarMobileCollapsedEmpty => 'Nothing today';

  @override
  String get calendarMobileConnectPrompt => 'Connect Google Calendar →';
}
