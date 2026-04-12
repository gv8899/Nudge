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
}
