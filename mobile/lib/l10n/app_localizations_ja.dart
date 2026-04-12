// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Japanese (`ja`).
class AppL10nJa extends AppL10n {
  AppL10nJa([String locale = 'ja']) : super(locale);

  @override
  String get commonSave => '保存';

  @override
  String get commonCancel => 'キャンセル';

  @override
  String get commonDelete => '削除';

  @override
  String get settingsTitle => '設定';

  @override
  String get settingsAccountSection => 'アカウント';

  @override
  String get settingsAccountUnnamed => '名称未設定';

  @override
  String settingsAccountJoinedAt(Object date) {
    return '$date 登録';
  }

  @override
  String get settingsThemeSection => 'テーマ';

  @override
  String get settingsThemeLight => 'ライト';

  @override
  String get settingsThemeDark => 'ダーク';

  @override
  String get settingsThemeSystem => 'システム';

  @override
  String get settingsAppearanceSection => '外観';

  @override
  String get settingsAppearancePaperLabel => '紙質感';

  @override
  String get settingsAppearancePaperDesc => '背景に紙のざらつきを加えます';

  @override
  String get settingsLanguageSection => '言語';

  @override
  String get settingsLanguageZhTW => '繁中';

  @override
  String get settingsLanguageEn => 'EN';

  @override
  String get settingsLanguageJa => '日本語';

  @override
  String get settingsLanguageAuto => '自動';

  @override
  String get settingsLanguageUpdateFailed => '言語を切り替えできませんでした。後で再試行してください。';

  @override
  String get settingsTagsSection => 'タグ';

  @override
  String get settingsCleanUntitledLabel => '空白カードを削除';

  @override
  String get settingsCleanUntitledLabelLoading => '削除中…';

  @override
  String get settingsCleanUntitledConfirmTitle => '空白カードを削除';

  @override
  String get settingsCleanUntitledConfirmBody =>
      'タイトル未入力のカードがすべて削除されます。よろしいですか？';

  @override
  String get settingsCleanUntitledConfirmOk => '削除する';

  @override
  String settingsCleanUntitledSuccessWithCount(Object count) {
    return '$count 件の空白カードを削除しました';
  }

  @override
  String get settingsCleanUntitledSuccessEmpty => '削除対象がありません';

  @override
  String get settingsCleanUntitledFailed => '削除に失敗しました';

  @override
  String get settingsLogoutButton => 'ログアウト';

  @override
  String get settingsLogoutConfirmTitle => 'ログアウト';

  @override
  String get settingsLogoutConfirmBody => '本当にログアウトしますか？';

  @override
  String get tagsAdd => '追加';

  @override
  String get tagsAddTag => 'タグ追加';

  @override
  String get tagsAddTagShort => 'タグ追加';

  @override
  String get tagsChangeColor => '色';

  @override
  String get tagsCreate => '作成';

  @override
  String tagsCreateNamed(Object name) {
    return '「$name」を作成';
  }

  @override
  String get tagsDeleteTitle => 'タグを削除';

  @override
  String tagsDeleteConfirm(Object name) {
    return '「$name」を削除しますか？';
  }

  @override
  String tagsDeleteTagAria(Object name) {
    return '$name を削除';
  }

  @override
  String get tagsNewTagPlaceholder => '新しいタグ...';

  @override
  String tagsRemoveAria(Object name) {
    return '$name を外す';
  }

  @override
  String get tagsSearchOrCreate => 'タグを検索・作成...';

  @override
  String get navTasks => 'アクション';

  @override
  String get navNotes => 'ジャーナル';

  @override
  String get navCards => 'カード';

  @override
  String get navSettings => '設定';

  @override
  String get navMainNavAria => 'メインナビ';

  @override
  String get navSettingsAria => '設定を開く';

  @override
  String get loginTagline => '毎日のタスクをそっと後押し';

  @override
  String get loginSignInWithGoogle => 'Google でサインイン';

  @override
  String get loginLoginFailed => 'サインインに失敗しました。もう一度お試しください。';
}
