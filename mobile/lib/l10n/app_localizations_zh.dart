// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Chinese (`zh`).
class AppL10nZh extends AppL10n {
  AppL10nZh([String locale = 'zh']) : super(locale);

  @override
  String get commonSave => '儲存';

  @override
  String get commonCancel => '取消';

  @override
  String get commonDelete => '刪除';

  @override
  String get settingsTitle => '設定';

  @override
  String get settingsAccountSection => '帳號資料';

  @override
  String get settingsAccountUnnamed => '未命名';

  @override
  String settingsAccountJoinedAt(Object date) {
    return '加入於 $date';
  }

  @override
  String get settingsThemeSection => '主題';

  @override
  String get settingsThemeLight => '淺色';

  @override
  String get settingsThemeDark => '深色';

  @override
  String get settingsThemeSystem => '跟隨系統';

  @override
  String get settingsAppearanceSection => '外觀';

  @override
  String get settingsAppearancePaperLabel => '紙質感';

  @override
  String get settingsAppearancePaperDesc => '讓背景帶有細微的紙張顆粒紋理';

  @override
  String get settingsLanguageSection => '語言';

  @override
  String get settingsLanguageZhTW => '繁中';

  @override
  String get settingsLanguageEn => 'EN';

  @override
  String get settingsLanguageJa => '日本語';

  @override
  String get settingsLanguageAuto => '自動';

  @override
  String get settingsLanguageUpdateFailed => '切換語言失敗，請稍後再試';

  @override
  String get settingsTagsSection => '標籤管理';

  @override
  String get settingsCleanUntitledLabel => '清除空白卡片';

  @override
  String get settingsCleanUntitledLabelLoading => '清除中…';

  @override
  String get settingsCleanUntitledConfirmTitle => '清除空白卡片';

  @override
  String get settingsCleanUntitledConfirmBody => '這會刪除所有沒有標題的卡片，確定嗎？';

  @override
  String get settingsCleanUntitledConfirmOk => '確定清除';

  @override
  String settingsCleanUntitledSuccessWithCount(Object count) {
    return '已清除 $count 張空白卡片';
  }

  @override
  String get settingsCleanUntitledSuccessEmpty => '沒有需要清除的卡片';

  @override
  String get settingsCleanUntitledFailed => '清除失敗';

  @override
  String get settingsLogoutButton => '登出';

  @override
  String get settingsLogoutConfirmTitle => '登出';

  @override
  String get settingsLogoutConfirmBody => '確定要登出嗎？';

  @override
  String get tagsAdd => '新增';

  @override
  String get tagsAddTag => '新增標籤';

  @override
  String get tagsAddTagShort => '加標籤';

  @override
  String get tagsChangeColor => '換色';

  @override
  String get tagsCreate => '建立';

  @override
  String tagsCreateNamed(Object name) {
    return '建立「$name」';
  }

  @override
  String get tagsDeleteTitle => '刪除標籤';

  @override
  String tagsDeleteConfirm(Object name) {
    return '確定要刪除「$name」嗎？';
  }

  @override
  String tagsDeleteTagAria(Object name) {
    return '刪除 $name';
  }

  @override
  String get tagsNewTagPlaceholder => '新增標籤...';

  @override
  String tagsRemoveAria(Object name) {
    return '移除 $name';
  }

  @override
  String get tagsSearchOrCreate => '搜尋或建立標籤...';

  @override
  String get navTasks => '行動';

  @override
  String get navNotes => '日誌';

  @override
  String get navCards => '卡片';

  @override
  String get navSettings => '設定';

  @override
  String get navMainNavAria => '主導覽';

  @override
  String get navSettingsAria => '開啟設定';

  @override
  String get loginTagline => '輕量型每日任務推進工具';

  @override
  String get loginSignInWithGoogle => '使用 Google 帳號登入';

  @override
  String get loginLoginFailed => '登入失敗，請再試一次';

  @override
  String taskDragReorder(Object title) {
    return '拖曳排序：$title';
  }

  @override
  String taskCheckboxAria(Object title, Object state) {
    return '$title：$state';
  }

  @override
  String get taskStateCompleted => '已完成';

  @override
  String get taskStateIncomplete => '未完成';

  @override
  String get taskEditTitleAria => '編輯任務標題';

  @override
  String taskExpandContentAria(Object title) {
    return '展開「$title」的內文';
  }

  @override
  String get taskDetailExpandPage => '展開為單頁';

  @override
  String get taskDetailClose => '關閉';

  @override
  String get taskDetailContentPlaceholder => '輸入內文...';

  @override
  String get taskCreatePlaceholder => '新增任務';

  @override
  String get taskMoveToOtherDay => '移到其他天';

  @override
  String get taskViewDetails => '查看詳情';

  @override
  String get taskComplete => '完成任務';

  @override
  String get taskUncomplete => '取消完成';

  @override
  String get taskMoveToOtherDate => '移到其他日期';

  @override
  String get editorDragBlockAria => '拖動區塊';

  @override
  String get editorDragBlockTitle => '拖動以重新排序';

  @override
  String get editorCodeLangAria => '切換語言';

  @override
  String get editorCodeCopyAria => '複製';

  @override
  String get editorCodeCopiedAria => '已複製';

  @override
  String get editorCodeCopyTitle => '複製程式碼';

  @override
  String get editorSlashNoResults => '沒有符合的項目';

  @override
  String get editorSlashH1Label => '標題 1';

  @override
  String get editorSlashH1Description => '大標題';

  @override
  String get editorSlashH1Keywords => 'h1|head|heading|標題|大標題';

  @override
  String get editorSlashH2Label => '標題 2';

  @override
  String get editorSlashH2Description => '中標題';

  @override
  String get editorSlashH2Keywords => 'h2|head|heading|標題|中標題';

  @override
  String get editorSlashH3Label => '標題 3';

  @override
  String get editorSlashH3Description => '小標題';

  @override
  String get editorSlashH3Keywords => 'h3|head|heading|標題|小標題';

  @override
  String get editorSlashBulletLabel => '項目符號列表';

  @override
  String get editorSlashBulletDescription => '建立無序列表';

  @override
  String get editorSlashBulletKeywords => 'list|bullet|ul|項目|清單|列表';

  @override
  String get editorSlashOrderedLabel => '數字列表';

  @override
  String get editorSlashOrderedDescription => '建立編號列表';

  @override
  String get editorSlashOrderedKeywords => 'ol|number|ordered|數字|編號|列表';

  @override
  String get editorSlashTodoLabel => '待辦列表';

  @override
  String get editorSlashTodoDescription => '可勾選的待辦清單';

  @override
  String get editorSlashTodoKeywords => 'todo|task|check|待辦|任務';

  @override
  String get editorSlashQuoteLabel => '引言';

  @override
  String get editorSlashQuoteDescription => '引用區塊';

  @override
  String get editorSlashQuoteKeywords => 'quote|blockquote|引用|引言';

  @override
  String get editorSlashCodeLabel => '程式碼區塊';

  @override
  String get editorSlashCodeDescription => '含語法高亮的程式碼區塊';

  @override
  String get editorSlashCodeKeywords => 'code|block|程式|程式碼';

  @override
  String get editorSlashDividerLabel => '分隔線';

  @override
  String get editorSlashDividerDescription => '插入水平分隔線';

  @override
  String get editorSlashDividerKeywords => 'hr|divider|separator|分隔|分隔線';
}
