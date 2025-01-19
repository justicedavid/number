import { firestore } from 'firebase';
import { ThunkAction, ThunkDispatch } from "redux-thunk";
import { ExtraComment } from '../reducers/commentReducer';
import { notificationTypes } from '../reducers/notificationReducer';
import { ExtraPost, LIMIT_POSTS_PER_LOADING, Post, PostAction, postActionTypes, PostErrorAction, PostList, PostSuccessAction } from '../reducers/postReducer';
import { HashTag, UserInfo } from '../reducers/userReducer';
import { store } from "../store";
import { generateUsernameKeywords, Timestamp, getImageClass } from '../utils';
import { LoadMoreCommentListSuccess } from './commentActions';
import { CreateNotificationRequest } from './notificationActions';

export var FetchPostListRequest = ():
    ThunkAction<Promise<void>, {}, {}, PostAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, PostAction>) => {
        try {
            var me = store.getState().user.user
            var myUsername = `${store.getState().user.user.userInfo?.username}`
            var currentBlockedList = store.getState().user
                .setting?.privacy?.blockedAccounts?.blockedAccounts || []
            var userRef = firestore().collection('users')
            var blockMe = await userRef
                .where('privacySetting.blockedAccounts.blockedAccounts',
                    'array-contains', myUsername)
                .get()
            var blockedMeList = blockMe.docs.map(x => x.data().username)
            var request = await firestore()
                .collection('users')
                .doc(me.userInfo?.username)
                .get()

            var result: UserInfo = request.data() || {}
            if (result) {
                var follwingList: string[] = result.followings || []
                var userIds: string[] = []
                let collection: Post[] = []
                while (follwingList.length > 0
                    && collection.length < LIMIT_POSTS_PER_LOADING) {
                    var rs = await firestore().collection('posts')
                        .where('userId', 'in', follwingList.splice(0, 10))
                        .orderBy('create_at', 'desc')
                        .limit(LIMIT_POSTS_PER_LOADING - collection.length)
                        .get()
                    var temp = rs.docs.map(doc => {
                        if (userIds.indexOf(doc.data().userId) < 0) userIds.push(doc.data().userId)
                        let post = { ...doc.data() }
                        var rqCmt = doc.ref.collection('comments')
                            .orderBy('create_at', 'desc').get()
                        rqCmt.then(rsx => {
                            post.comments = rsx.docs.map(docx => docx.data())
                        })
                        return post as Post
                    }).filter(x => currentBlockedList.indexOf(`${x.userId}`) < 0
                        && blockedMeList.indexOf(`${x.userId}`) < 0
                    )
                    collection = collection.concat(temp)
                }
                let ownInfos: UserInfo[] = []
                while (userIds.length > 0) {
                    var rs = await firestore().collection('users')
                        .where('username', 'in', userIds.splice(0, 10))
                        .get()
                    var temp = rs.docs.map(doc => {
                        return doc.data()
                    })
                    ownInfos = ownInfos.concat(temp)
                }
                var extraPostList: PostList = collection.map((post, index) => {
                    var extraPost: ExtraPost = Object.assign(post, {
                        ownUser: ownInfos.filter(x => x.username === post.userId)[0]
                    })
                    return extraPost
                })
                dispatch(FetchPostListSuccess(extraPostList))
            } else dispatch(FetchPostListFailure())
        } catch (e) {
            console.warn(e)
            dispatch(FetchPostListFailure())
        }
    }
}
export var FetchPostListFailure = (): PostErrorAction => {
    return {
        type: postActionTypes.FETCH_POST_LIST_FAILURE,
        payload: {
            message: 'Get Post List Failed!'
        }
    }
}
export var FetchPostListSuccess = (payload: PostList): PostSuccessAction<PostList> => {
    return {
        type: postActionTypes.FETCH_POST_LIST_SUCCESS,
        payload: payload
    }
}
/**
 * LOADING MORE ACTIONS 
 */
export var LoadMorePostListRequest = ():
    ThunkAction<Promise<void>, {}, {}, PostAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, PostAction>) => {
        try {
            var me = store.getState().user.user
            var myUsername = `${store.getState().user.user.userInfo?.username}`
            var currentBlockedList = store.getState().user
                .setting?.privacy?.blockedAccounts?.blockedAccounts || []
            var userRef = firestore().collection('users')
            var blockMe = await userRef
                .where('privacySetting.blockedAccounts.blockedAccounts',
                    'array-contains', myUsername)
                .get()
            var blockedMeList = blockMe.docs.map(x => x.data().username)
            var request = await firestore()
                .collection('users')
                .doc(me.userInfo?.username)
                .get()
            var result = request.data()
            var loadedUids = store.getState().postList
                .map(post => post.uid).filter(id => id !== undefined)

            if (result) {
                var follwingList: string[] = result.followings
                var userIds: string[] = []
                let collection: Post[] = []
                while (follwingList.length > 0
                    && collection.length < LIMIT_POSTS_PER_LOADING) {
                    var rs = await firestore().collection('posts')
                        .where('userId', 'in', follwingList.splice(0, 10))
                        .orderBy('create_at', 'desc')
                        .limit(LIMIT_POSTS_PER_LOADING + loadedUids.length)
                        .get()
                    rs.docs.map(doc => {
                        if (loadedUids.indexOf(doc.data().uid) < 0
                            && collection.length < LIMIT_POSTS_PER_LOADING) {
                            if (userIds.indexOf(doc.data().userId) < 0)
                                userIds.push(doc.data().userId)
                            let post = { ...doc.data() }
                            doc.ref.collection('comments')
                                .orderBy('create_at', 'desc').get().then(rqCmt => {
                                    post.comments = rqCmt.docs.map(docx => docx.data())
                                    if (collection.length < LIMIT_POSTS_PER_LOADING
                                        && currentBlockedList.indexOf(`${post.userId}`) < 0
                                        && blockedMeList.indexOf(`${post.userId}`) < 0
                                    ) {
                                        collection.push(post)
                                    }

                                })
                        }
                    })
                }

                let ownInfos: UserInfo[] = []
                while (userIds.length > 0) {
                    var usernames = userIds.splice(0, 10)
                    var rs = await firestore().collection('users')
                        .where('username', 'in', usernames)
                        .get()
                    var temp = rs.docs.map(doc => {
                        return doc.data()
                    })
                    ownInfos = ownInfos.concat(temp)
                }
                var extraPostList: PostList = collection.map((post, index) => {
                    var extraPost: ExtraPost = Object.assign(post, {
                        ownUser: ownInfos.filter(x => x.username === post.userId)[0]
                    })
                    return extraPost
                })
                dispatch(LoadMorePostListSuccess(extraPostList))
            } else dispatch(LoadMorePostListFailure())
        } catch (e) {
            dispatch(LoadMorePostListFailure())
        }
    }
}
export var LoadMorePostListFailure = (): PostErrorAction => {
    return {
        type: postActionTypes.LOAD_MORE_POST_LIST_FAILURE,
        payload: {
            message: 'Can not load more posts!'
        }
    }
}
export var LoadMorePostListSuccess = (payload: PostList): PostSuccessAction<PostList> => {
    return {
        type: postActionTypes.LOAD_MORE_POST_LIST_SUCCESS,
        payload: payload
    }
}
/**
 * POST COMMENTS ACTIONS
 */
export var PostCommentRequest = (postId: number,
    content: string,
    postData?: ExtraPost,
    setPost?: React.Dispatch<React.SetStateAction<ExtraPost>>):
    ThunkAction<Promise<void>, {}, {}, PostAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, PostAction>) => {
        try {
            var me = store.getState().user.user
            let postList = [...store.getState().postList]
            var ref = firestore()
            var rq = await ref.collection('posts').where('uid', '==', postId).get()
            if (rq.size > 0) {
                var targetPost = rq.docs[0]
                let commentList = targetPost.data().commentList || []
                if (commentList.length > 0 && commentList.indexOf(me.userInfo?.username) < 0) {
                    commentList.push(me.userInfo?.username)
                } else commentList = [me.userInfo?.username]
                targetPost.ref.update({
                    commentList
                })

                var uid = new Date().getTime()
                targetPost.ref.collection('comments').doc(`${uid}`).set({
                    uid: uid,
                    content,
                    likes: [],
                    userId: me.userInfo?.username,
                    create_at: new Date()
                })
                //ADD NOTIFICATION
                if (targetPost.data().userId !== me.userInfo?.username) {
                    var notificationList = targetPost.data().notificationUsers || []
                    var myIndex = notificationList.indexOf(me.userInfo?.username || '')
                    if (myIndex > -1) notificationList.splice(myIndex, 1)
                    dispatch(CreateNotificationRequest({
                        postId,
                        replyId: 0,
                        commentId: uid,
                        userId: notificationList,
                        from: me.userInfo?.username,
                        create_at: Timestamp(),
                        type: notificationTypes.COMMENT_MY_POST
                    }))
                }
                var rq2 = await targetPost.ref.collection('comments')
                    .orderBy('create_at', 'desc').get()
                if (postData && setPost) {
                    var post = { ...postData }
                    post.comments = rq2.docs.map(x => x.data())
                    setPost(post)
                } else {
                    postList = postList.map((post) => {
                        if (post.uid === postId) {
                            post = { ...post }
                            post.comments = rq2.docs.map(x => x.data())
                        }
                        return post
                    })
                    var comment: ExtraComment = rq2.docs[0].data()
                    comment.ownUser = me.userInfo
                    var payload = {
                        comments: [comment],
                        scrollDown: true
                    }
                    dispatch(LoadMoreCommentListSuccess(payload))
                    dispatch(PostCommentSuccess(postList))
                }

            } else {
                dispatch(PostCommentFailure())
            }
        } catch (e) {
            console.warn(e)
            dispatch(PostCommentFailure())
        }
    }
}
export var PostCommentFailure = (): PostErrorAction => {
    return {
        type: postActionTypes.COMMENT_POST_FAILURE,
        payload: {
            message: 'Can not load more posts!'
        }
    }
}
export var PostCommentSuccess = (payload: PostList): PostSuccessAction<PostList> => {
    return {
        type: postActionTypes.COMMENT_POST_SUCCESS,
        payload: payload
    }
}

/**
 * TOGGLE LIKE POST ACTIONS
 */
export var ToggleLikePostRequest = (postId: number,
    postData?: ExtraPost,
    setPost?: React.Dispatch<React.SetStateAction<ExtraPost>>):
    ThunkAction<Promise<void>, {}, {}, PostAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, PostAction>) => {
        try {
            var me = store.getState().user.user
            let postList = [...store.getState().postList]
            var ref = firestore()
            var rq = await ref.collection('posts').where('uid', '==', postId).get()
            if (rq.docs.length > 0) {
                var targetPost: Post = rq.docs[0].data() || {}
                var index = (targetPost.likes || []).indexOf(
                    me.userInfo?.username || '')
                if (index > -1) {
                    targetPost.likes?.splice(index, 1)
                } else targetPost.likes?.push(me.userInfo?.username || '')
                rq.docs[0].ref.update({
                    likes: targetPost.likes
                })
                if (postData && setPost) {
                    var post = { ...postData, likes: targetPost.likes }
                    setPost(post)
                } else {
                    postList = postList.map((post) => {
                        if (post.uid === postId) {
                            post = { ...post, likes: targetPost.likes }
                        }
                        return post
                    })
                    dispatch(ToggleLikePostSuccess(postList))
                }
                if (targetPost.userId !== me.userInfo?.username
                ) {
                    var notificationList = targetPost.notificationUsers || []
                    var myIndex = notificationList.indexOf(me.userInfo?.username || '')
                    if (myIndex > -1) notificationList.splice(myIndex, 1)
                    if (notificationList.length > 0) {
                        if (index < 0)
                            dispatch(CreateNotificationRequest({
                                postId,
                                commentId: 0,
                                replyId: 0,
                                userId: notificationList,
                                from: me.userInfo?.username,
                                create_at: Timestamp(),
                                type: notificationTypes.LIKE_MY_POST
                            }))
                        else dispatch(CreateNotificationRequest({
                            isUndo: true,
                            postId,
                            commentId: 0,
                            replyId: 0,
                            userId: notificationList,
                            from: me.userInfo?.username,
                            create_at: Timestamp(),
                            type: notificationTypes.LIKE_MY_POST
                        }))
                    }
                }
            } else {
                dispatch(ToggleLikePostFailure())
            }
        } catch (e) {
            dispatch(ToggleLikePostFailure())
        }
    }
}
export var ToggleLikePostFailure = (): PostErrorAction => {
    return {
        type: postActionTypes.TOGGLE_LIKE_POST_FAILURE,
        payload: {
            message: 'Can not load more posts!'
        }
    }
}
export var ToggleLikePostSuccess = (payload: PostList): PostSuccessAction<PostList> => {
    return {
        type: postActionTypes.TOGGLE_LIKE_POST_SUCCESS,
        payload: payload
    }
}
//CREATE POST ACTION
export var CreatePostRequest = (postData: Post):
    ThunkAction<Promise<void>, {}, {}, PostAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, PostAction>) => {
        try {
            var me = store.getState().user.user.userInfo
            var ref = firestore()
            var rq = await ref.collection('users')
                .where('username', '==', me?.username).get()
            var uid = new Date().getTime()
            //Regex Hashtags
            var regex = /\#\w+/gm
            var str = postData.content || ''
            let m
            let hashTagList: string[] = []
            while ((m = regex.exec(str)) !== null) {
                if (m.index === regex.lastIndex) {
                    regex.lastIndex++
                }
                m.forEach((match, groupIndex) => {
                    hashTagList.push(match)
                })
            }
            hashTagList = Array.from(new Set(hashTagList))
            postData.hashtags = [...hashTagList]
            if (rq.size > 0) {
                var labels = await Promise.all(
                    postData.source?.map(async img => {
                        return await getImageClass(img.uri)
                    }) || []
                )
                ref.collection('posts').doc(`${uid}`).set({
                    ...postData,
                    uid,
                    labels
                })
                dispatch(FetchPostListRequest())
                hashTagList.map(async hashtag => {
                    var rq = await ref.collection('hashtags')
                        .where('name', '==', hashtag).get()
                    if (rq.size > 0) {
                        var targetHashtag = rq.docs[0]
                        var data: HashTag = targetHashtag.data() || {}
                        var sources = (data.sources || [])
                        sources.push(uid)
                        targetHashtag.ref.update({
                            sources
                        })
                    } else {
                        var keyword = generateUsernameKeywords(hashtag)
                        keyword.splice(0, 1)
                        var fetchRelatedTags: Promise<string[]>[] = keyword.map(async character => {
                            var rq = await ref.collection('hashtags').
                                where('keyword', 'array-contains', character).get()
                            var data: HashTag[] = rq.docs.map(x => x.data() || {})
                            return data.map(x => x.name || '')
                        })
                        Promise.all(fetchRelatedTags).then(rs => {
                            let relatedTags: string[] = []
                            rs.map(lv1 => {
                                lv1.map(x => relatedTags.push(x))
                            })
                            relatedTags = Array.from(new Set(relatedTags))
                            relatedTags.map(async tag => {
                                var rq = await ref.collection('hashtags').doc(`${tag}`).get()
                                if (rq.exists) {
                                    var currentRelatedTags = (rq.data() || {}).relatedTags || []
                                    currentRelatedTags.push(hashtag)
                                    rq.ref.update({
                                        relatedTags: currentRelatedTags
                                    })
                                }
                            })
                            var hashtagUid = new Date().getTime()
                            ref.collection('hashtags').doc(hashtag).set({
                                name: hashtag,
                                followers: [],
                                keyword,
                                relatedTags,
                                sources: [uid],
                                uid: hashtagUid
                            })
                        })
                    }
                })
            } else {
                dispatch(CreatePostFailure())
            }

        } catch (e) {
            dispatch(CreatePostFailure())
        }
    }
}
export var CreatePostFailure = (): PostErrorAction => {
    return {
        type: postActionTypes.CREATE_POST_FAILURE,
        payload: {
            message: 'Can not post this post!'
        }
    }
}
// export var CreatePostSuccess = (payload: PostList): PostSuccessAction<PostList> => {
//     return {
//         type: postActionTypes.CREATE_POST_SUCCESS,
//         payload: payload
//     }
// }
//UPDATE POST ACTION
export var UpdatePostRequest = (uid: number, updatedData: ExtraPost):
    ThunkAction<Promise<void>, {}, {}, PostAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, PostAction>) => {
        try {
            var me = store.getState().user.user.userInfo
            let postList = [...store.getState().postList]
            var ref = firestore()
            var rq = await ref.collection('users')
                .where('username', '==', me?.username).get()
            var rq2 = await ref.collection('posts').doc(`${uid}`).get()
            var posts = postList.filter(p => p.uid === uid)
            if (rq.size > 0 && rq2.exists && posts.length > 0) {
                let onlinePost: ExtraPost = rq2.data() || {}
                var targetPost = { ...posts[0] }
                rq2.ref.update({
                    ...onlinePost, ...updatedData
                }).then(() => {
                    dispatch(UpdatePostSuccess({
                        ownUser: targetPost.ownUser
                        , ...onlinePost, ...updatedData
                    }))
                })
                    .catch((err) => {
                        dispatch(UpdatePostFailure())
                    })

            } else {
                dispatch(UpdatePostFailure())
            }
        } catch (e) {
            dispatch(UpdatePostFailure())
        }
    }
}
export var UpdatePostFailure = (): PostErrorAction => {
    return {
        type: postActionTypes.UPDATE_POST_FAILURE,
        payload: {
            message: 'Can not update post now!'
        }
    }
}
export var UpdatePostSuccess = (payload: ExtraPost): PostSuccessAction<ExtraPost> => {
    return {
        type: postActionTypes.UPDATE_POST_SUCCESS,
        payload: payload
    }
}
