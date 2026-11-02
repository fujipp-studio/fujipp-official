-- New opt-in version. Existing OCR licenses, configuration and designs are untouched.
INSERT INTO shop.feature_versions (id, feature_product_id, version, runtime_key, changelog, status)
SELECT 'f0800000-0000-0000-0000-000000000004', product.id, '3.0.0', 'price-reader',
       'Read Discord Shop screenshots with a customer-owned Gemini API key. Keeps deterministic shop pricing and message designs.', 'DRAFT'
FROM shop.feature_products product WHERE product.code='price-reader';

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type, is_required,
    is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT target.id, source.config_key, source.label, source.description, source.value_type,
       source.is_required, source.is_secret, source.default_value, source.validation_schema,
       source.ui_metadata, source.sort_order
FROM shop.feature_config_definitions source
JOIN shop.feature_versions previous ON previous.id=source.feature_version_id AND previous.version='2.0.0'
JOIN shop.feature_products product ON product.id=previous.feature_product_id AND product.code='price-reader'
JOIN shop.feature_versions target ON target.feature_product_id=product.id AND target.version='3.0.0';

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type, is_required,
    is_secret, default_value, validation_schema, ui_metadata, sort_order
) VALUES
('f0800000-0000-0000-0000-000000000004','GEMINI_API_KEY','Gemini API key',
 'สร้าง API key ของคุณใน Google AI Studio ระบบเก็บแบบเข้ารหัส โควตาและค่าใช้จ่ายเป็นของโปรเจกต์คุณ',
 'SECRET',true,true,NULL,'{"minLength":20,"maxLength":512,"pattern":"^[A-Za-z0-9_-]+$"}'::jsonb,
 '{"control":"secret"}'::jsonb,1),
('f0800000-0000-0000-0000-000000000004','PRICE_READER_GEMINI_MODEL','โมเดล Gemini',
 'เลือกโมเดลที่รองรับรูปภาพและ Structured output ตรวจสอบโควตา Free Tier ใน Google AI Studio',
 'TEXT',true,false,'"gemini-3.5-flash-lite"'::jsonb,
 '{"pattern":"^gemini-[a-z0-9][a-z0-9._-]{0,99}$","maxLength":107}'::jsonb,
 '{"control":"text"}'::jsonb,2);

INSERT INTO shop.feature_presentation_slots (
    feature_version_id, slot_key, label, description, presentation_type,
    available_variables, default_definition, validation_schema, sort_order
)
SELECT target.id, source.slot_key, source.label, source.description, source.presentation_type,
       source.available_variables, source.default_definition, source.validation_schema, source.sort_order
FROM shop.feature_presentation_slots source
JOIN shop.feature_versions previous ON previous.id=source.feature_version_id AND previous.version='2.0.0'
JOIN shop.feature_products product ON product.id=previous.feature_product_id AND product.code='price-reader'
JOIN shop.feature_versions target ON target.feature_product_id=product.id AND target.version='3.0.0';
