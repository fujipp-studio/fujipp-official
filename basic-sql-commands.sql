-- Basic SQL commands reference
-- PostgreSQL / Supabase examples
-- Uncomment and adapt the statements before running them.

-- 1. Create a table
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    age INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 1.ชื่อ 2.type (ตัวเลข INTEGER, ตัวอักษร TEXT, วันที่ TIMESTAMPTZ) 3. NOT NULL (ไม่สามารถเป็นค่าว่างได้) 4. DEFAULT (ค่าที่กำหนดไว้ล่วงหน้า) 5. PRIMARY KEY (คีย์หลัก) 6. UNIQUE (ค่าที่ไม่ซ้ำกัน)

-- 2. Add a column
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Insert data
INSERT INTO users (name, email, age)
VALUES ('Alice', 'alice@example.com', 25);

-- Insert multiple rows
INSERT INTO users (name, email, age)
VALUES
    ('Bob', 'bob@example.com', 30),
    ('Carol', 'carol@example.com', 28);

-- 4. Read data
SELECT * FROM users;
SELECT name, email FROM users;
SELECT * FROM users WHERE age >= 18;
SELECT * FROM users ORDER BY created_at DESC;
SELECT * FROM users LIMIT 10 OFFSET 0;

-- 5. Update data
UPDATE users
SET age = 26
WHERE email = 'alice@example.com';

-- 6. Delete data
DELETE FROM users
WHERE email = 'alice@example.com';

-- 7. Aggregate functions
SELECT COUNT(*) AS total_users FROM users;
SELECT AVG(age) AS average_age FROM users WHERE age IS NOT NULL;
SELECT age, COUNT(*) AS users_with_age
FROM users
GROUP BY age
ORDER BY age;

-- 8. Search and null checks
SELECT * FROM users WHERE name ILIKE '%ali%';
SELECT * FROM users WHERE age IS NULL;
SELECT * FROM users WHERE age BETWEEN 18 AND 30;
SELECT * FROM users WHERE email IN ('alice@example.com', 'bob@example.com');

-- 9. Join two tables
SELECT users.name, orders.total_amount
FROM users
JOIN orders ON orders.user_id = users.id
WHERE orders.total_amount > 0;

-- 10. Create an index
CREATE INDEX idx_users_email ON users (email);

-- 11. Transaction
BEGIN;
UPDATE users SET age = age + 1 WHERE id = 1;
DELETE FROM users WHERE id = 2;
COMMIT;
-- Use ROLLBACK instead of COMMIT to undo the transaction.

-- 12. Common table commands
TRUNCATE TABLE users; -- Remove all rows
DROP TABLE users;     -- Remove the table and its data

-- 13. Inspect table structure in PostgreSQL
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
