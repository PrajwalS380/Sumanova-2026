-- Covering indexes for foreign keys (performance advisor): keeps joins and
-- cascading account deletion fast as data grows.
create index if not exists albums_user_idx on public.albums (user_id);
create index if not exists calls_caller_idx on public.calls (caller_id);
create index if not exists conversations_created_by_idx on public.conversations (created_by);
create index if not exists highlight_items_story_idx on public.highlight_items (story_id);
create index if not exists highlights_user_idx on public.highlights (user_id);
create index if not exists memories_album_idx on public.memories (album_id);
create index if not exists message_reactions_user_idx on public.message_reactions (user_id);
create index if not exists messages_reply_to_idx on public.messages (reply_to_id);
create index if not exists notifications_actor_idx on public.notifications (actor_id);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists reports_target_user_idx on public.reports (target_user_id);
create index if not exists reports_target_video_idx on public.reports (target_video_id);
create index if not exists snap_recipients_conversation_idx on public.snap_recipients (conversation_id);
create index if not exists stories_group_idx on public.stories (group_id);
create index if not exists story_audience_user_idx on public.story_audience (user_id);
create index if not exists story_views_viewer_idx on public.story_views (viewer_id);
create index if not exists streaks_user_b_idx on public.streaks (user_b);
create index if not exists video_comments_user_idx on public.video_comments (user_id);
create index if not exists video_likes_user_idx on public.video_likes (user_id);
create index if not exists video_saves_user_idx on public.video_saves (user_id);
create index if not exists video_views_user_idx on public.video_views (user_id);
