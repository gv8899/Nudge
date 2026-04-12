import 'package:flutter/material.dart';

class Tag {
  final String id;
  final String name;
  final String color;
  final int sortOrder;

  const Tag({
    required this.id,
    required this.name,
    required this.color,
    required this.sortOrder,
  });

  factory Tag.fromJson(Map<String, dynamic> json) => Tag(
        id: json['id'] as String,
        name: json['name'] as String,
        color: json['color'] as String,
        sortOrder: json['sortOrder'] as int? ?? 0,
      );
}

class TagColor {
  final String value;
  final String label;
  final Color _light;
  final Color _dark;

  const TagColor(this.value, this.label, this._light, this._dark);

  /// 依目前 Theme brightness 取出該 tag 色；直接讀 context 避免靜態狀態同步問題
  Color resolve(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? _dark : _light;

  static const List<TagColor> all = [
    TagColor('chart-1', '灰藍', Color(0xFF5A6B7C), Color(0xFF7A8B9C)),
    TagColor('chart-2', '琥珀', Color(0xFFA87A45), Color(0xFFC89968)),
    TagColor('chart-3', '橄欖', Color(0xFF5A7050), Color(0xFF8AA57D)),
    TagColor('chart-4', '紫藤', Color(0xFF8A6D92), Color(0xFFA78AAF)),
    TagColor('chart-5', '赭紅', Color(0xFF9A4F3F), Color(0xFFB56B5A)),
    TagColor('primary', '主色', Color(0xFFA87A45), Color(0xFFC89968)),
    TagColor('status-waiting', '藏青', Color(0xFF8A6D92), Color(0xFFA78AAF)),
    TagColor('status-in-progress', '天藍', Color(0xFFA87A45), Color(0xFFC89968)),
  ];

  static Color forToken(BuildContext context, String tokenName) {
    return all
        .firstWhere((c) => c.value == tokenName, orElse: () => all[0])
        .resolve(context);
  }
}
