-- Лише два варіанти картки: «З фото на першій» (hero) і «Без фото на першій» (auto).
UPDATE articles SET card_style = 'auto' WHERE card_style IN ('image', 'text');
