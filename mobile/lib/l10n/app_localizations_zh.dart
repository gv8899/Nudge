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
}
