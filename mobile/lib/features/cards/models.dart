class CardItem {
  final String id;
  final String title;
  final String description;
  final String createdAt;
  final String updatedAt;
  final List<CardTag> tags;

  const CardItem({
    required this.id,
    required this.title,
    required this.description,
    required this.createdAt,
    required this.updatedAt,
    required this.tags,
  });

  factory CardItem.fromJson(Map<String, dynamic> json) => CardItem(
        id: json['id'] as String,
        title: json['title'] as String,
        description: json['description'] as String? ?? '',
        createdAt: json['createdAt'] as String,
        updatedAt: json['updatedAt'] as String,
        tags: (json['tags'] as List?)
                ?.map((e) => CardTag.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class CardTag {
  final String id;
  final String name;
  final String color;

  const CardTag({
    required this.id,
    required this.name,
    required this.color,
  });

  factory CardTag.fromJson(Map<String, dynamic> json) => CardTag(
        id: json['id'] as String,
        name: json['name'] as String,
        color: json['color'] as String,
      );
}
