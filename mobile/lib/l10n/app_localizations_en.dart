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
}
