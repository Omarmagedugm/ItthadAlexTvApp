import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  Send, 
  Image as ImageIcon, 
  MapPin, 
  Sparkles, 
  Pin, 
  MoreVertical,
  CheckCircle,
  Clock,
  Filter
} from 'lucide-react';
import { WorldPost, WorldGroup } from '../../types/worldFans';
import { useAppStore } from '../../store';
import { doc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { v4 as uuidv4 } from 'uuid';

interface WorldFeedTabProps {
  posts: WorldPost[];
  groups: WorldGroup[];
  selectedGroupId?: string;
  onPostCreated?: () => void;
}

const CATEGORIES = [
  { id: 'all', label: 'الكل 🌍' },
  { id: 'gatherings', label: 'تجمعات ومشاهدات ☕' },
  { id: 'photos', label: 'صور ومعالم 📸' },
  { id: 'match_day', label: 'يوم المباراة ⚽' },
  { id: 'general', label: 'نقاشات المغتربين 💬' },
];

export const WorldFeedTab: React.FC<WorldFeedTabProps> = ({
  posts,
  groups,
  selectedGroupId,
}) => {
  const { profile, worldPosts, setWorldPosts } = useAppStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newPostContent, setNewPostContent] = useState<string>('');
  const [newPostImage, setNewPostImage] = useState<string>('');
  const [selectedGroupForPost, setSelectedGroupForPost] = useState<string>(selectedGroupId || '');
  const [postCategory, setPostCategory] = useState<string>('general');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<string>('');

  const currentUser = auth.currentUser;

  // Filter posts
  const filteredPosts = posts.filter(post => {
    if (selectedGroupId && post.groupId !== selectedGroupId) return false;
    if (selectedCategory === 'all') return true;
    return post.category === selectedCategory;
  });

  // Handle post creation
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;

    setIsSubmitting(true);
    try {
      const selectedGroup = groups.find(g => g.id === selectedGroupForPost);
      const newPost: WorldPost = {
        id: uuidv4(),
        groupId: selectedGroupForPost || 'general',
        groupName: selectedGroup ? selectedGroup.name : 'ملتقى عام',
        groupFlag: selectedGroup ? selectedGroup.countryFlag : '🌍',
        groupCity: selectedGroup ? selectedGroup.city : 'العالم',
        groupVerified: selectedGroup ? selectedGroup.verified : false,
        countryName: selectedGroup ? selectedGroup.countryName : (profile.location || 'مغترب'),
        countryCode: selectedGroup ? selectedGroup.countryFlag : '🌍',
        authorId: currentUser?.uid || 'guest',
        authorName: profile.name || currentUser?.displayName || 'عاشق الاتحاد السكندري',
        authorAvatar: profile.avatar || currentUser?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80',
        content: newPostContent.trim(),
        type: 'post',
        images: newPostImage.trim() ? [newPostImage.trim()] : undefined,
        category: postCategory,
        likes: 0,
        likedBy: [],
        commentsCount: 0,
        comments: [],
        createdAt: new Date().toISOString(),
      };

      // Save locally in Zustand immediately
      setWorldPosts([newPost, ...worldPosts]);

      // Save to Firestore if available
      try {
        await setDoc(doc(db, 'world_posts', newPost.id), newPost);
      } catch (err) {
        console.warn('Saved locally, firestore sync note:', err);
      }

      setNewPostContent('');
      setNewPostImage('');
    } catch (err) {
      console.error('Error creating post:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Like
  const handleToggleLike = async (postId: string) => {
    const userId = currentUser?.uid || 'guest_user';
    const updated = worldPosts.map(post => {
      if (post.id !== postId) return post;
      const alreadyLiked = post.likedBy?.includes(userId);
      const newLikedBy = alreadyLiked 
        ? post.likedBy?.filter(id => id !== userId) || []
        : [...(post.likedBy || []), userId];
      return {
        ...post,
        likes: newLikedBy.length,
        likedBy: newLikedBy,
      };
    });

    setWorldPosts(updated);

    try {
      const targetPost = worldPosts.find(p => p.id === postId);
      const alreadyLiked = targetPost?.likedBy?.includes(userId);
      await updateDoc(doc(db, 'world_posts', postId), {
        likes: alreadyLiked ? (targetPost?.likes || 1) - 1 : (targetPost?.likes || 0) + 1,
        likedBy: alreadyLiked ? arrayRemove(userId) : arrayUnion(userId)
      });
    } catch (e) {
      console.warn('Like updated locally:', e);
    }
  };

  // Handle Add Comment
  const handleAddComment = async (postId: string) => {
    if (!commentText.trim()) return;

    const newComment = {
      id: uuidv4(),
      userId: currentUser?.uid || 'guest',
      userName: profile.name || currentUser?.displayName || 'اتحداوي',
      userAvatar: profile.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80',
      content: commentText.trim(),
      text: commentText.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated = worldPosts.map(post => {
      if (post.id !== postId) return post;
      const currentComments = post.comments || [];
      return {
        ...post,
        commentsCount: (post.commentsCount || 0) + 1,
        comments: [...currentComments, newComment],
      };
    });

    setWorldPosts(updated);
    setCommentText('');

    try {
      await updateDoc(doc(db, 'world_posts', postId), {
        commentsCount: (worldPosts.find(p => p.id === postId)?.commentsCount || 0) + 1,
        comments: arrayUnion(newComment)
      });
    } catch (e) {
      console.warn('Comment added locally:', e);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Post Composer Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-800/90 p-4 sm:p-5 shadow-sm border border-slate-200/80 dark:border-slate-700/70">
        <div className="flex items-start gap-3">
          <img
            src={profile.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80'}
            alt=""
            className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1">
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="شارك صورة، تجمع، أو لحظة تشجيع لسيد البلد من مدينتك بالخارج..."
              rows={3}
              className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all resize-none"
            />

            {/* Optional Image URL */}
            <div className="mt-2 flex items-center gap-2">
              <input
                type="url"
                value={newPostImage}
                onChange={(e) => setNewPostImage(e.target.value)}
                placeholder="رابط صورة (اختياري - كافيه، تيشيرت، تجمع، علم الاتحاد)..."
                className="flex-1 text-[11px] font-medium bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-1.5 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Options Bar & Submit */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {/* League/Group Selector if not fixed */}
                {!selectedGroupId && (
                  <select
                    value={selectedGroupForPost}
                    onChange={(e) => setSelectedGroupForPost(e.target.value)}
                    className="text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-2.5 py-1.5 border-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">ملتقى عام (كل المغتربين 🌍)</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.countryFlag} {g.name}</option>
                    ))}
                  </select>
                )}

                {/* Category Selector */}
                <select
                  value={postCategory}
                  onChange={(e) => setPostCategory(e.target.value)}
                  className="text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-2.5 py-1.5 border-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="general">نقاشات 💬</option>
                  <option value="gatherings">تجمعات ومشاهدات ☕</option>
                  <option value="photos">صور ومعالم 📸</option>
                  <option value="match_day">يوم المباراة ⚽</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleCreatePost}
                disabled={!newPostContent.trim() || isSubmitting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Send size={13} />
                <span>{isSubmitting ? 'جاري النشر...' : 'نشر'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feed Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
              selectedCategory === cat.id
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Posts List */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-12 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-400">لا توجد منشورات في هذا التصنيف بعد. كن أول من يشارك!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const isLiked = post.likedBy?.includes(currentUser?.uid || 'guest_user');
            const showComments = activeCommentPostId === post.id;

            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 p-4 sm:p-5 shadow-sm overflow-hidden"
              >
                {/* Pinned Tag */}
                {post.pinned && (
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-500 mb-3 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-xl w-fit">
                    <Pin size={13} className="rotate-45" />
                    <span>منشور مثبت من الإدارة</span>
                  </div>
                )}

                {/* Author Info */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={post.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80'}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-emerald-500/40"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-black text-slate-800 dark:text-white">
                          {post.authorName}
                        </h4>
                        <span className="text-xs">{post.countryCode}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                        <span>{post.groupName || post.countryName}</span>
                        <span>•</span>
                        <span>{new Date(post.createdAt).toLocaleDateString('ar-EG')}</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {post.category === 'gatherings' ? 'تجمع ☕' : post.category === 'photos' ? 'صورة 📸' : post.category === 'match_day' ? 'مباراة ⚽' : 'نقاش 💬'}
                  </span>
                </div>

                {/* Content */}
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-line mb-3">
                  {post.content}
                </p>

                {/* Images */}
                {post.images && post.images.length > 0 && (
                  <div className="rounded-2xl overflow-hidden mb-3 border border-slate-100 dark:border-slate-700 max-h-96">
                    <img
                      src={post.images[0]}
                      alt=""
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                {/* Post Footer Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleToggleLike(post.id)}
                      className={`flex items-center gap-1.5 font-bold transition-all ${
                        isLiked ? 'text-red-500 scale-105' : 'text-slate-500 dark:text-slate-400 hover:text-red-500'
                      }`}
                    >
                      <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                      <span>{post.likes || 0}</span>
                    </button>

                    <button
                      onClick={() => setActiveCommentPostId(showComments ? null : post.id)}
                      className="flex items-center gap-1.5 font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                    >
                      <MessageSquare size={16} />
                      <span>{post.commentsCount || post.comments?.length || 0} تعليق</span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: 'رابطة اتحاداوية العالم', text: post.content, url: window.location.href });
                      }
                    }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    <Share2 size={16} />
                  </button>
                </div>

                {/* Comments Expandable Section */}
                {showComments && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-3">
                    {/* Add Comment */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                        placeholder="اكتب تعليقك..."
                        className="flex-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none"
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95"
                      >
                        <Send size={14} />
                      </button>
                    </div>

                    {/* Comments List */}
                    {post.comments && post.comments.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {post.comments.map((comment) => (
                          <div key={comment.id} className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-800 dark:text-white">{comment.userName}</span>
                              <span className="text-[9px] text-slate-400">{new Date(comment.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{comment.content || comment.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 text-center py-2">لا توجد تعليقات بعد. كن أول من يعلق!</p>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
