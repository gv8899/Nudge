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

  /// No description provided for @commonLoading.
  ///
  /// In zh, this message translates to:
  /// **'載入中...'**
  String get commonLoading;

  /// No description provided for @commonLoadFailed.
  ///
  /// In zh, this message translates to:
  /// **'載入失敗'**
  String get commonLoadFailed;

  /// No description provided for @commonToday.
  ///
  /// In zh, this message translates to:
  /// **'今天'**
  String get commonToday;

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

  /// No description provided for @navTasks.
  ///
  /// In zh, this message translates to:
  /// **'行動'**
  String get navTasks;

  /// No description provided for @navNotes.
  ///
  /// In zh, this message translates to:
  /// **'日誌'**
  String get navNotes;

  /// No description provided for @navCards.
  ///
  /// In zh, this message translates to:
  /// **'卡片'**
  String get navCards;

  /// No description provided for @navSettings.
  ///
  /// In zh, this message translates to:
  /// **'設定'**
  String get navSettings;

  /// No description provided for @navMainNavAria.
  ///
  /// In zh, this message translates to:
  /// **'主導覽'**
  String get navMainNavAria;

  /// No description provided for @navSettingsAria.
  ///
  /// In zh, this message translates to:
  /// **'開啟設定'**
  String get navSettingsAria;

  /// No description provided for @loginTagline.
  ///
  /// In zh, this message translates to:
  /// **'輕量型每日任務推進工具'**
  String get loginTagline;

  /// No description provided for @loginSignInWithGoogle.
  ///
  /// In zh, this message translates to:
  /// **'使用 Google 帳號登入'**
  String get loginSignInWithGoogle;

  /// No description provided for @loginLoginFailed.
  ///
  /// In zh, this message translates to:
  /// **'登入失敗，請再試一次'**
  String get loginLoginFailed;

  /// No description provided for @taskDragReorder.
  ///
  /// In zh, this message translates to:
  /// **'拖曳排序：{title}'**
  String taskDragReorder(Object title);

  /// No description provided for @taskCheckboxAria.
  ///
  /// In zh, this message translates to:
  /// **'{title}：{state}'**
  String taskCheckboxAria(Object title, Object state);

  /// No description provided for @taskStateCompleted.
  ///
  /// In zh, this message translates to:
  /// **'已完成'**
  String get taskStateCompleted;

  /// No description provided for @taskStateIncomplete.
  ///
  /// In zh, this message translates to:
  /// **'未完成'**
  String get taskStateIncomplete;

  /// No description provided for @taskEditTitleAria.
  ///
  /// In zh, this message translates to:
  /// **'編輯任務標題'**
  String get taskEditTitleAria;

  /// No description provided for @taskExpandContentAria.
  ///
  /// In zh, this message translates to:
  /// **'展開「{title}」的內文'**
  String taskExpandContentAria(Object title);

  /// No description provided for @taskDetailExpandPage.
  ///
  /// In zh, this message translates to:
  /// **'展開為單頁'**
  String get taskDetailExpandPage;

  /// No description provided for @taskDetailClose.
  ///
  /// In zh, this message translates to:
  /// **'關閉'**
  String get taskDetailClose;

  /// No description provided for @taskDetailContentPlaceholder.
  ///
  /// In zh, this message translates to:
  /// **'輸入內文...'**
  String get taskDetailContentPlaceholder;

  /// No description provided for @taskCreatePlaceholder.
  ///
  /// In zh, this message translates to:
  /// **'新增任務'**
  String get taskCreatePlaceholder;

  /// No description provided for @taskMoveToOtherDay.
  ///
  /// In zh, this message translates to:
  /// **'移到其他天'**
  String get taskMoveToOtherDay;

  /// No description provided for @taskViewDetails.
  ///
  /// In zh, this message translates to:
  /// **'查看詳情'**
  String get taskViewDetails;

  /// No description provided for @taskComplete.
  ///
  /// In zh, this message translates to:
  /// **'完成任務'**
  String get taskComplete;

  /// No description provided for @taskUncomplete.
  ///
  /// In zh, this message translates to:
  /// **'取消完成'**
  String get taskUncomplete;

  /// No description provided for @taskMoveToOtherDate.
  ///
  /// In zh, this message translates to:
  /// **'移到其他日期'**
  String get taskMoveToOtherDate;

  /// No description provided for @editorDragBlockAria.
  ///
  /// In zh, this message translates to:
  /// **'拖動區塊'**
  String get editorDragBlockAria;

  /// No description provided for @editorDragBlockTitle.
  ///
  /// In zh, this message translates to:
  /// **'拖動以重新排序'**
  String get editorDragBlockTitle;

  /// No description provided for @editorCodeLangAria.
  ///
  /// In zh, this message translates to:
  /// **'切換語言'**
  String get editorCodeLangAria;

  /// No description provided for @editorCodeCopyAria.
  ///
  /// In zh, this message translates to:
  /// **'複製'**
  String get editorCodeCopyAria;

  /// No description provided for @editorCodeCopiedAria.
  ///
  /// In zh, this message translates to:
  /// **'已複製'**
  String get editorCodeCopiedAria;

  /// No description provided for @editorCodeCopyTitle.
  ///
  /// In zh, this message translates to:
  /// **'複製程式碼'**
  String get editorCodeCopyTitle;

  /// No description provided for @editorSlashNoResults.
  ///
  /// In zh, this message translates to:
  /// **'沒有符合的項目'**
  String get editorSlashNoResults;

  /// No description provided for @editorSlashTextLabel.
  ///
  /// In zh, this message translates to:
  /// **'內文'**
  String get editorSlashTextLabel;

  /// No description provided for @editorSlashTextDescription.
  ///
  /// In zh, this message translates to:
  /// **'普通段落文字'**
  String get editorSlashTextDescription;

  /// No description provided for @editorSlashTextKeywords.
  ///
  /// In zh, this message translates to:
  /// **'text|paragraph|body|內文|段落|普通'**
  String get editorSlashTextKeywords;

  /// No description provided for @editorSlashH1Label.
  ///
  /// In zh, this message translates to:
  /// **'標題 1'**
  String get editorSlashH1Label;

  /// No description provided for @editorSlashH1Description.
  ///
  /// In zh, this message translates to:
  /// **'大標題'**
  String get editorSlashH1Description;

  /// No description provided for @editorSlashH1Keywords.
  ///
  /// In zh, this message translates to:
  /// **'h1|head|heading|標題|大標題'**
  String get editorSlashH1Keywords;

  /// No description provided for @editorSlashH2Label.
  ///
  /// In zh, this message translates to:
  /// **'標題 2'**
  String get editorSlashH2Label;

  /// No description provided for @editorSlashH2Description.
  ///
  /// In zh, this message translates to:
  /// **'中標題'**
  String get editorSlashH2Description;

  /// No description provided for @editorSlashH2Keywords.
  ///
  /// In zh, this message translates to:
  /// **'h2|head|heading|標題|中標題'**
  String get editorSlashH2Keywords;

  /// No description provided for @editorSlashH3Label.
  ///
  /// In zh, this message translates to:
  /// **'標題 3'**
  String get editorSlashH3Label;

  /// No description provided for @editorSlashH3Description.
  ///
  /// In zh, this message translates to:
  /// **'小標題'**
  String get editorSlashH3Description;

  /// No description provided for @editorSlashH3Keywords.
  ///
  /// In zh, this message translates to:
  /// **'h3|head|heading|標題|小標題'**
  String get editorSlashH3Keywords;

  /// No description provided for @editorSlashBulletLabel.
  ///
  /// In zh, this message translates to:
  /// **'項目符號列表'**
  String get editorSlashBulletLabel;

  /// No description provided for @editorSlashBulletDescription.
  ///
  /// In zh, this message translates to:
  /// **'建立無序列表'**
  String get editorSlashBulletDescription;

  /// No description provided for @editorSlashBulletKeywords.
  ///
  /// In zh, this message translates to:
  /// **'list|bullet|ul|項目|清單|列表'**
  String get editorSlashBulletKeywords;

  /// No description provided for @editorSlashOrderedLabel.
  ///
  /// In zh, this message translates to:
  /// **'數字列表'**
  String get editorSlashOrderedLabel;

  /// No description provided for @editorSlashOrderedDescription.
  ///
  /// In zh, this message translates to:
  /// **'建立編號列表'**
  String get editorSlashOrderedDescription;

  /// No description provided for @editorSlashOrderedKeywords.
  ///
  /// In zh, this message translates to:
  /// **'ol|number|ordered|數字|編號|列表'**
  String get editorSlashOrderedKeywords;

  /// No description provided for @editorSlashTodoLabel.
  ///
  /// In zh, this message translates to:
  /// **'待辦列表'**
  String get editorSlashTodoLabel;

  /// No description provided for @editorSlashTodoDescription.
  ///
  /// In zh, this message translates to:
  /// **'可勾選的待辦清單'**
  String get editorSlashTodoDescription;

  /// No description provided for @editorSlashTodoKeywords.
  ///
  /// In zh, this message translates to:
  /// **'todo|task|check|待辦|任務'**
  String get editorSlashTodoKeywords;

  /// No description provided for @editorSlashQuoteLabel.
  ///
  /// In zh, this message translates to:
  /// **'引言'**
  String get editorSlashQuoteLabel;

  /// No description provided for @editorSlashQuoteDescription.
  ///
  /// In zh, this message translates to:
  /// **'引用區塊'**
  String get editorSlashQuoteDescription;

  /// No description provided for @editorSlashQuoteKeywords.
  ///
  /// In zh, this message translates to:
  /// **'quote|blockquote|引用|引言'**
  String get editorSlashQuoteKeywords;

  /// No description provided for @editorSlashCodeLabel.
  ///
  /// In zh, this message translates to:
  /// **'程式碼區塊'**
  String get editorSlashCodeLabel;

  /// No description provided for @editorSlashCodeDescription.
  ///
  /// In zh, this message translates to:
  /// **'含語法高亮的程式碼區塊'**
  String get editorSlashCodeDescription;

  /// No description provided for @editorSlashCodeKeywords.
  ///
  /// In zh, this message translates to:
  /// **'code|block|程式|程式碼'**
  String get editorSlashCodeKeywords;

  /// No description provided for @editorSlashDividerLabel.
  ///
  /// In zh, this message translates to:
  /// **'分隔線'**
  String get editorSlashDividerLabel;

  /// No description provided for @editorSlashDividerDescription.
  ///
  /// In zh, this message translates to:
  /// **'插入水平分隔線'**
  String get editorSlashDividerDescription;

  /// No description provided for @editorSlashDividerKeywords.
  ///
  /// In zh, this message translates to:
  /// **'hr|divider|separator|分隔|分隔線'**
  String get editorSlashDividerKeywords;

  /// No description provided for @dailyEmptyToday.
  ///
  /// In zh, this message translates to:
  /// **'今天還沒有任務'**
  String get dailyEmptyToday;

  /// No description provided for @dailyOverdueSectionAria.
  ///
  /// In zh, this message translates to:
  /// **'前幾天的任務'**
  String get dailyOverdueSectionAria;

  /// No description provided for @dailyOverdueLabel.
  ///
  /// In zh, this message translates to:
  /// **'前幾天的 ({count})'**
  String dailyOverdueLabel(Object count);

  /// No description provided for @dailyOverdueScheduleToday.
  ///
  /// In zh, this message translates to:
  /// **'排入今天'**
  String get dailyOverdueScheduleToday;

  /// No description provided for @dailyOverdueOriginalDateAria.
  ///
  /// In zh, this message translates to:
  /// **'原始日期：{date}'**
  String dailyOverdueOriginalDateAria(Object date);

  /// No description provided for @dailyOverdueArchiveAria.
  ///
  /// In zh, this message translates to:
  /// **'封存任務：{title}'**
  String dailyOverdueArchiveAria(Object title);

  /// No description provided for @dailyOverdueIncompleteAria.
  ///
  /// In zh, this message translates to:
  /// **'{title}：未完成'**
  String dailyOverdueIncompleteAria(Object title);

  /// No description provided for @dailyArchiveTitle.
  ///
  /// In zh, this message translates to:
  /// **'封存任務'**
  String get dailyArchiveTitle;

  /// No description provided for @dailyArchiveConfirmBody.
  ///
  /// In zh, this message translates to:
  /// **'確定要封存「{title}」嗎？封存後不會出現在任務列表。'**
  String dailyArchiveConfirmBody(Object title);

  /// No description provided for @dailyArchiveButton.
  ///
  /// In zh, this message translates to:
  /// **'封存'**
  String get dailyArchiveButton;

  /// No description provided for @dailyCalendarNavAria.
  ///
  /// In zh, this message translates to:
  /// **'週曆導航'**
  String get dailyCalendarNavAria;

  /// No description provided for @dailyPrevWeekAria.
  ///
  /// In zh, this message translates to:
  /// **'上一週'**
  String get dailyPrevWeekAria;

  /// No description provided for @dailyNextWeekAria.
  ///
  /// In zh, this message translates to:
  /// **'下一週'**
  String get dailyNextWeekAria;

  /// No description provided for @dailyDateAria.
  ///
  /// In zh, this message translates to:
  /// **'{month}月{day}日 {weekday}'**
  String dailyDateAria(Object month, Object day, Object weekday);

  /// No description provided for @dailyTodayButton.
  ///
  /// In zh, this message translates to:
  /// **'今天'**
  String get dailyTodayButton;

  /// No description provided for @cardsCreateAria.
  ///
  /// In zh, this message translates to:
  /// **'新增卡片'**
  String get cardsCreateAria;

  /// No description provided for @cardsCleanUntitledAria.
  ///
  /// In zh, this message translates to:
  /// **'清除空白的卡片'**
  String get cardsCleanUntitledAria;

  /// No description provided for @cardsViewListAria.
  ///
  /// In zh, this message translates to:
  /// **'列表檢視'**
  String get cardsViewListAria;

  /// No description provided for @cardsViewGridAria.
  ///
  /// In zh, this message translates to:
  /// **'網格檢視'**
  String get cardsViewGridAria;

  /// No description provided for @cardsSearchPlaceholder.
  ///
  /// In zh, this message translates to:
  /// **'搜尋卡片...'**
  String get cardsSearchPlaceholder;

  /// No description provided for @cardsSearchAria.
  ///
  /// In zh, this message translates to:
  /// **'搜尋卡片'**
  String get cardsSearchAria;

  /// No description provided for @cardsEmptyWithQuery.
  ///
  /// In zh, this message translates to:
  /// **'沒有符合的卡片'**
  String get cardsEmptyWithQuery;

  /// No description provided for @cardsEmptyNoCards.
  ///
  /// In zh, this message translates to:
  /// **'還沒有寫過內容的任務'**
  String get cardsEmptyNoCards;

  /// No description provided for @cardsEmptyMobile.
  ///
  /// In zh, this message translates to:
  /// **'還沒有卡片'**
  String get cardsEmptyMobile;

  /// No description provided for @cardsLoadMore.
  ///
  /// In zh, this message translates to:
  /// **'載入更多...'**
  String get cardsLoadMore;

  /// No description provided for @cardsNoMore.
  ///
  /// In zh, this message translates to:
  /// **'沒有更多卡片了'**
  String get cardsNoMore;

  /// No description provided for @cardsCleanDialogTitle.
  ///
  /// In zh, this message translates to:
  /// **'清除空白的卡片'**
  String get cardsCleanDialogTitle;

  /// No description provided for @cardsCleanDialogBody.
  ///
  /// In zh, this message translates to:
  /// **'將刪除所有沒有標題的卡片，此操作無法復原。'**
  String get cardsCleanDialogBody;

  /// No description provided for @cardsCleanConfirmButton.
  ///
  /// In zh, this message translates to:
  /// **'確定清除'**
  String get cardsCleanConfirmButton;

  /// No description provided for @cardsCleanLoading.
  ///
  /// In zh, this message translates to:
  /// **'清除中...'**
  String get cardsCleanLoading;

  /// No description provided for @cardsToastCleaned.
  ///
  /// In zh, this message translates to:
  /// **'已清除 {count} 張空白卡片'**
  String cardsToastCleaned(Object count);

  /// No description provided for @cardsToastNothingToClean.
  ///
  /// In zh, this message translates to:
  /// **'沒有需要清除的卡片'**
  String get cardsToastNothingToClean;

  /// No description provided for @cardDetailBackToCards.
  ///
  /// In zh, this message translates to:
  /// **'返回卡片'**
  String get cardDetailBackToCards;

  /// No description provided for @cardDetailNotFound.
  ///
  /// In zh, this message translates to:
  /// **'找不到這張卡片'**
  String get cardDetailNotFound;

  /// No description provided for @cardDetailEditTitleAria.
  ///
  /// In zh, this message translates to:
  /// **'編輯標題'**
  String get cardDetailEditTitleAria;

  /// No description provided for @cardDetailEditorPlaceholder.
  ///
  /// In zh, this message translates to:
  /// **'打 / 插入標題、清單…'**
  String get cardDetailEditorPlaceholder;

  /// No description provided for @cardDetailTitleHint.
  ///
  /// In zh, this message translates to:
  /// **'標題'**
  String get cardDetailTitleHint;

  /// No description provided for @cardDetailCreatedAt.
  ///
  /// In zh, this message translates to:
  /// **'建立 {date}'**
  String cardDetailCreatedAt(Object date);

  /// No description provided for @cardDetailUpdatedAt.
  ///
  /// In zh, this message translates to:
  /// **'更新 {date}'**
  String cardDetailUpdatedAt(Object date);

  /// No description provided for @notesBackToCanvasAria.
  ///
  /// In zh, this message translates to:
  /// **'回到今天 canvas'**
  String get notesBackToCanvasAria;

  /// No description provided for @notesBackToCanvasTitle.
  ///
  /// In zh, this message translates to:
  /// **'回到今天'**
  String get notesBackToCanvasTitle;

  /// No description provided for @notesEmptyFeedPrompt.
  ///
  /// In zh, this message translates to:
  /// **'還沒有過去的日記。現在先從今天開始寫吧。'**
  String get notesEmptyFeedPrompt;

  /// No description provided for @notesEmptyFeedShort.
  ///
  /// In zh, this message translates to:
  /// **'還沒有過去的日記'**
  String get notesEmptyFeedShort;

  /// No description provided for @notesGoToCanvas.
  ///
  /// In zh, this message translates to:
  /// **'去今天的 canvas'**
  String get notesGoToCanvas;

  /// No description provided for @notesGoToToday.
  ///
  /// In zh, this message translates to:
  /// **'去今天的日誌'**
  String get notesGoToToday;

  /// No description provided for @notesNoMoreEntries.
  ///
  /// In zh, this message translates to:
  /// **'沒有更多日記了'**
  String get notesNoMoreEntries;

  /// No description provided for @notesCanvasPlaceholder.
  ///
  /// In zh, this message translates to:
  /// **'寫點什麼⋯⋯'**
  String get notesCanvasPlaceholder;

  /// No description provided for @notesCanvasToggleFeedAria.
  ///
  /// In zh, this message translates to:
  /// **'切換到 feed'**
  String get notesCanvasToggleFeedAria;

  /// No description provided for @notesCanvasToggleFeedTitle.
  ///
  /// In zh, this message translates to:
  /// **'切換到 feed'**
  String get notesCanvasToggleFeedTitle;

  /// No description provided for @notesEntryAria.
  ///
  /// In zh, this message translates to:
  /// **'{year}年{month}月{day}日的日記'**
  String notesEntryAria(Object year, Object month, Object day);

  /// No description provided for @notesMonthLabel.
  ///
  /// In zh, this message translates to:
  /// **'{month} 月'**
  String notesMonthLabel(Object month);

  /// No description provided for @calendarSection.
  ///
  /// In zh, this message translates to:
  /// **'行事曆'**
  String get calendarSection;

  /// No description provided for @calendarConnectTitle.
  ///
  /// In zh, this message translates to:
  /// **'連結 Google Calendar'**
  String get calendarConnectTitle;

  /// No description provided for @calendarConnectDescription.
  ///
  /// In zh, this message translates to:
  /// **'看看今天有哪些會議'**
  String get calendarConnectDescription;

  /// No description provided for @calendarConnectButton.
  ///
  /// In zh, this message translates to:
  /// **'連結'**
  String get calendarConnectButton;

  /// No description provided for @calendarDisconnectButton.
  ///
  /// In zh, this message translates to:
  /// **'中斷連結'**
  String get calendarDisconnectButton;

  /// No description provided for @calendarDisconnectConfirmTitle.
  ///
  /// In zh, this message translates to:
  /// **'中斷連結'**
  String get calendarDisconnectConfirmTitle;

  /// No description provided for @calendarDisconnectConfirmBody.
  ///
  /// In zh, this message translates to:
  /// **'確定要中斷 Google Calendar 連結嗎？'**
  String get calendarDisconnectConfirmBody;

  /// No description provided for @calendarConnectedAs.
  ///
  /// In zh, this message translates to:
  /// **'已連結：{email}'**
  String calendarConnectedAs(Object email);

  /// No description provided for @calendarSubCalendars.
  ///
  /// In zh, this message translates to:
  /// **'顯示哪些日曆'**
  String get calendarSubCalendars;

  /// No description provided for @calendarPanelTitle.
  ///
  /// In zh, this message translates to:
  /// **'今日行程'**
  String get calendarPanelTitle;

  /// No description provided for @calendarPanelEmpty.
  ///
  /// In zh, this message translates to:
  /// **'今天沒有行程'**
  String get calendarPanelEmpty;

  /// No description provided for @calendarPanelLoading.
  ///
  /// In zh, this message translates to:
  /// **'載入中…'**
  String get calendarPanelLoading;

  /// No description provided for @calendarPanelError.
  ///
  /// In zh, this message translates to:
  /// **'無法載入行事曆'**
  String get calendarPanelError;

  /// No description provided for @calendarPanelRetry.
  ///
  /// In zh, this message translates to:
  /// **'重試'**
  String get calendarPanelRetry;

  /// No description provided for @calendarPanelReauth.
  ///
  /// In zh, this message translates to:
  /// **'授權過期，請重新連結'**
  String get calendarPanelReauth;

  /// No description provided for @calendarPanelRefresh.
  ///
  /// In zh, this message translates to:
  /// **'重新整理'**
  String get calendarPanelRefresh;

  /// No description provided for @calendarEventAllDay.
  ///
  /// In zh, this message translates to:
  /// **'整日'**
  String get calendarEventAllDay;

  /// No description provided for @calendarEventBusy.
  ///
  /// In zh, this message translates to:
  /// **'忙碌'**
  String get calendarEventBusy;

  /// No description provided for @calendarEventLocation.
  ///
  /// In zh, this message translates to:
  /// **'地點'**
  String get calendarEventLocation;

  /// No description provided for @calendarEventAttendees.
  ///
  /// In zh, this message translates to:
  /// **'與會者'**
  String get calendarEventAttendees;

  /// No description provided for @calendarEventDescription.
  ///
  /// In zh, this message translates to:
  /// **'描述'**
  String get calendarEventDescription;

  /// No description provided for @calendarEventOpenInGoogle.
  ///
  /// In zh, this message translates to:
  /// **'在 Google Calendar 開啟'**
  String get calendarEventOpenInGoogle;

  /// No description provided for @calendarMobileCollapsedCount.
  ///
  /// In zh, this message translates to:
  /// **'今日行程 · {count} 件'**
  String calendarMobileCollapsedCount(Object count);

  /// No description provided for @calendarMobileCollapsedEmpty.
  ///
  /// In zh, this message translates to:
  /// **'今日無行程'**
  String get calendarMobileCollapsedEmpty;

  /// No description provided for @calendarMobileConnectPrompt.
  ///
  /// In zh, this message translates to:
  /// **'連結 Google Calendar →'**
  String get calendarMobileConnectPrompt;
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
