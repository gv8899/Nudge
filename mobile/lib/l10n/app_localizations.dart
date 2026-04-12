import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_ja.dart';
import 'app_localizations_zh.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppL10n
/// returned by `AppL10n.of(context)`.
///
/// Applications need to include `AppL10n.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppL10n.localizationsDelegates,
///   supportedLocales: AppL10n.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppL10n.supportedLocales
/// property.
abstract class AppL10n {
  AppL10n(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppL10n? of(BuildContext context) {
    return Localizations.of<AppL10n>(context, AppL10n);
  }

  static const LocalizationsDelegate<AppL10n> delegate = _AppL10nDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('ja'),
    Locale('zh'),
  ];

  /// No description provided for @commonSave.
  ///
  /// In zh, this message translates to:
  /// **'儲存'**
  String get commonSave;

  /// No description provided for @commonCancel.
  ///
  /// In zh, this message translates to:
  /// **'取消'**
  String get commonCancel;

  /// No description provided for @commonDelete.
  ///
  /// In zh, this message translates to:
  /// **'刪除'**
  String get commonDelete;

  /// No description provided for @settingsTitle.
  ///
  /// In zh, this message translates to:
  /// **'設定'**
  String get settingsTitle;

  /// No description provided for @settingsAccountSection.
  ///
  /// In zh, this message translates to:
  /// **'帳號資料'**
  String get settingsAccountSection;

  /// No description provided for @settingsAccountUnnamed.
  ///
  /// In zh, this message translates to:
  /// **'未命名'**
  String get settingsAccountUnnamed;

  /// No description provided for @settingsAccountJoinedAt.
  ///
  /// In zh, this message translates to:
  /// **'加入於 {date}'**
  String settingsAccountJoinedAt(Object date);

  /// No description provided for @settingsThemeSection.
  ///
  /// In zh, this message translates to:
  /// **'主題'**
  String get settingsThemeSection;

  /// No description provided for @settingsThemeLight.
  ///
  /// In zh, this message translates to:
  /// **'淺色'**
  String get settingsThemeLight;

  /// No description provided for @settingsThemeDark.
  ///
  /// In zh, this message translates to:
  /// **'深色'**
  String get settingsThemeDark;

  /// No description provided for @settingsThemeSystem.
  ///
  /// In zh, this message translates to:
  /// **'跟隨系統'**
  String get settingsThemeSystem;

  /// No description provided for @settingsAppearanceSection.
  ///
  /// In zh, this message translates to:
  /// **'外觀'**
  String get settingsAppearanceSection;

  /// No description provided for @settingsAppearancePaperLabel.
  ///
  /// In zh, this message translates to:
  /// **'紙質感'**
  String get settingsAppearancePaperLabel;

  /// No description provided for @settingsAppearancePaperDesc.
  ///
  /// In zh, this message translates to:
  /// **'讓背景帶有細微的紙張顆粒紋理'**
  String get settingsAppearancePaperDesc;

  /// No description provided for @settingsLanguageSection.
  ///
  /// In zh, this message translates to:
  /// **'語言'**
  String get settingsLanguageSection;

  /// No description provided for @settingsLanguageZhTW.
  ///
  /// In zh, this message translates to:
  /// **'繁中'**
  String get settingsLanguageZhTW;

  /// No description provided for @settingsLanguageEn.
  ///
  /// In zh, this message translates to:
  /// **'EN'**
  String get settingsLanguageEn;

  /// No description provided for @settingsLanguageJa.
  ///
  /// In zh, this message translates to:
  /// **'日本語'**
  String get settingsLanguageJa;

  /// No description provided for @settingsLanguageAuto.
  ///
  /// In zh, this message translates to:
  /// **'自動'**
  String get settingsLanguageAuto;

  /// No description provided for @settingsLanguageUpdateFailed.
  ///
  /// In zh, this message translates to:
  /// **'切換語言失敗，請稍後再試'**
  String get settingsLanguageUpdateFailed;

  /// No description provided for @settingsTagsSection.
  ///
  /// In zh, this message translates to:
  /// **'標籤管理'**
  String get settingsTagsSection;

  /// No description provided for @settingsCleanUntitledLabel.
  ///
  /// In zh, this message translates to:
  /// **'清除空白卡片'**
  String get settingsCleanUntitledLabel;

  /// No description provided for @settingsCleanUntitledLabelLoading.
  ///
  /// In zh, this message translates to:
  /// **'清除中…'**
  String get settingsCleanUntitledLabelLoading;

  /// No description provided for @settingsCleanUntitledConfirmTitle.
  ///
  /// In zh, this message translates to:
  /// **'清除空白卡片'**
  String get settingsCleanUntitledConfirmTitle;

  /// No description provided for @settingsCleanUntitledConfirmBody.
  ///
  /// In zh, this message translates to:
  /// **'這會刪除所有沒有標題的卡片，確定嗎？'**
  String get settingsCleanUntitledConfirmBody;

  /// No description provided for @settingsCleanUntitledConfirmOk.
  ///
  /// In zh, this message translates to:
  /// **'確定清除'**
  String get settingsCleanUntitledConfirmOk;

  /// No description provided for @settingsCleanUntitledSuccessWithCount.
  ///
  /// In zh, this message translates to:
  /// **'已清除 {count} 張空白卡片'**
  String settingsCleanUntitledSuccessWithCount(Object count);

  /// No description provided for @settingsCleanUntitledSuccessEmpty.
  ///
  /// In zh, this message translates to:
  /// **'沒有需要清除的卡片'**
  String get settingsCleanUntitledSuccessEmpty;

  /// No description provided for @settingsCleanUntitledFailed.
  ///
  /// In zh, this message translates to:
  /// **'清除失敗'**
  String get settingsCleanUntitledFailed;

  /// No description provided for @settingsLogoutButton.
  ///
  /// In zh, this message translates to:
  /// **'登出'**
  String get settingsLogoutButton;

  /// No description provided for @settingsLogoutConfirmTitle.
  ///
  /// In zh, this message translates to:
  /// **'登出'**
  String get settingsLogoutConfirmTitle;

  /// No description provided for @settingsLogoutConfirmBody.
  ///
  /// In zh, this message translates to:
  /// **'確定要登出嗎？'**
  String get settingsLogoutConfirmBody;

  /// No description provided for @tagsAdd.
  ///
  /// In zh, this message translates to:
  /// **'新增'**
  String get tagsAdd;

  /// No description provided for @tagsAddTag.
  ///
  /// In zh, this message translates to:
  /// **'新增標籤'**
  String get tagsAddTag;

  /// No description provided for @tagsAddTagShort.
  ///
  /// In zh, this message translates to:
  /// **'加標籤'**
  String get tagsAddTagShort;

  /// No description provided for @tagsChangeColor.
  ///
  /// In zh, this message translates to:
  /// **'換色'**
  String get tagsChangeColor;

  /// No description provided for @tagsCreate.
  ///
  /// In zh, this message translates to:
  /// **'建立'**
  String get tagsCreate;

  /// No description provided for @tagsCreateNamed.
  ///
  /// In zh, this message translates to:
  /// **'建立「{name}」'**
  String tagsCreateNamed(Object name);

  /// No description provided for @tagsDeleteTitle.
  ///
  /// In zh, this message translates to:
  /// **'刪除標籤'**
  String get tagsDeleteTitle;

  /// No description provided for @tagsDeleteConfirm.
  ///
  /// In zh, this message translates to:
  /// **'確定要刪除「{name}」嗎？'**
  String tagsDeleteConfirm(Object name);

  /// No description provided for @tagsDeleteTagAria.
  ///
  /// In zh, this message translates to:
  /// **'刪除 {name}'**
  String tagsDeleteTagAria(Object name);

  /// No description provided for @tagsNewTagPlaceholder.
  ///
  /// In zh, this message translates to:
  /// **'新增標籤...'**
  String get tagsNewTagPlaceholder;

  /// No description provided for @tagsRemoveAria.
  ///
  /// In zh, this message translates to:
  /// **'移除 {name}'**
  String tagsRemoveAria(Object name);

  /// No description provided for @tagsSearchOrCreate.
  ///
  /// In zh, this message translates to:
  /// **'搜尋或建立標籤...'**
  String get tagsSearchOrCreate;
}

class _AppL10nDelegate extends LocalizationsDelegate<AppL10n> {
  const _AppL10nDelegate();

  @override
  Future<AppL10n> load(Locale locale) {
    return SynchronousFuture<AppL10n>(lookupAppL10n(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'ja', 'zh'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppL10nDelegate old) => false;
}

AppL10n lookupAppL10n(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppL10nEn();
    case 'ja':
      return AppL10nJa();
    case 'zh':
      return AppL10nZh();
  }

  throw FlutterError(
    'AppL10n.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
