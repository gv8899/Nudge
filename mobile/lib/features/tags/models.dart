import 'package:flutter/material.dart';
import '../../core/theme.dart';

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
  final Color color;

  const TagColor(this.value, this.label, this.color);

  static List<TagColor> get all => [
    const TagColor('chart-1', '灰藍', Color(0xFF7A8B9C)),
    const TagColor('chart-2', '琥珀', Color(0xFFC89968)),
    const TagColor('chart-3', '橄欖', Color(0xFF8AA57D)),
    const TagColor('chart-4', '紫藤', Color(0xFFA78AAF)),
    const TagColor('chart-5', '赭紅', Color(0xFFB56B5A)),
    TagColor('primary', '主色', AppColors.primary),
    const TagColor('status-waiting', '藏青', Color(0xFF9A7B4F)),
    const TagColor('status-in-progress', '天藍', Color(0xFF5A9BC5)),
  ];

  static Color resolve(String tokenName) {
    return all.firstWhere((c) => c.value == tokenName, orElse: () => all[0]).color;
  }
}
