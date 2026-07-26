-- ========== 晚心游戏社区 - Supabase 数据库建表 SQL ==========
-- 在 Supabase 项目的 SQL Editor 中执行此文件

-- 1. 帖子表
CREATE TABLE posts (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    content     TEXT NOT NULL DEFAULT '',
    category_id TEXT NOT NULL DEFAULT 'cat1',
    author_name TEXT NOT NULL DEFAULT '匿名',
    author_avatar TEXT NOT NULL DEFAULT '😊',
    images      JSONB DEFAULT '[]'::jsonb,
    likes       INTEGER NOT NULL DEFAULT 0,
    favs        INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 评论表
CREATE TABLE comments (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    content     TEXT NOT NULL DEFAULT '',
    author_name TEXT NOT NULL DEFAULT '匿名',
    author_avatar TEXT NOT NULL DEFAULT '😊',
    images      JSONB DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 点赞记录表
CREATE TABLE post_likes (
    id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id  BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_key TEXT NOT NULL,
    UNIQUE(post_id, user_key)
);

-- 4. 收藏记录表
CREATE TABLE post_favs (
    id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id  BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_key TEXT NOT NULL,
    UNIQUE(post_id, user_key)
);

-- 5. 索引
CREATE INDEX idx_posts_category ON posts(category_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_created ON comments(created_at ASC);
CREATE INDEX idx_post_likes_post ON post_likes(post_id);
CREATE INDEX idx_post_favs_post ON post_favs(post_id);

-- 6. 开启 Realtime (实时订阅)
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- 7. 点赞触发器：自动更新 posts.likes
CREATE OR REPLACE FUNCTION update_post_likes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET likes = likes + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET likes = GREATEST(0, likes - 1) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_likes_insert
    AFTER INSERT ON post_likes
    FOR EACH ROW EXECUTE FUNCTION update_post_likes();

CREATE TRIGGER trg_post_likes_delete
    AFTER DELETE ON post_likes
    FOR EACH ROW EXECUTE FUNCTION update_post_likes();

-- 8. 收藏触发器：自动更新 posts.favs
CREATE OR REPLACE FUNCTION update_post_favs()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET favs = favs + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET favs = GREATEST(0, favs - 1) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_favs_insert
    AFTER INSERT ON post_favs
    FOR EACH ROW EXECUTE FUNCTION update_post_favs();

CREATE TRIGGER trg_post_favs_delete
    AFTER DELETE ON post_favs
    FOR EACH ROW EXECUTE FUNCTION update_post_favs();

-- 9. 开启 Row Level Security（允许匿名读写）
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_favs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "允许所有人读取帖子" ON posts FOR SELECT USING (true);
CREATE POLICY "允许所有人创建帖子" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "允许所有人更新帖子" ON posts FOR UPDATE USING (true);

CREATE POLICY "允许所有人读取评论" ON comments FOR SELECT USING (true);
CREATE POLICY "允许所有人创建评论" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "允许所有人删除评论" ON comments FOR DELETE USING (true);

CREATE POLICY "允许所有人读取点赞" ON post_likes FOR SELECT USING (true);
CREATE POLICY "允许所有人创建点赞" ON post_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "允许所有人删除点赞" ON post_likes FOR DELETE USING (true);

CREATE POLICY "允许所有人读取收藏" ON post_favs FOR SELECT USING (true);
CREATE POLICY "允许所有人创建收藏" ON post_favs FOR INSERT WITH CHECK (true);
CREATE POLICY "允许所有人删除收藏" ON post_favs FOR DELETE USING (true);
