import { firestore } from 'firebase';
import { ThunkAction, ThunkDispatch } from "redux-thunk";
import { LIMIT_COMMENTS_PER_LOADING, CommentAction, CommentErrorAction, commentActionTypes, CommentExtraList, CommentList, CommentListWithScroll, CommentSuccessAction, ExtraComment } from '../reducers/commentReducer';
import { UserInfo } from '../reducers/userReducer';
import { store } from "../store";
import { CreateNotificationRequest } from './notificationActions';
import { Timestamp } from '../utils';
import { notificationTypes } from '../reducers/notificationReducer';
import { ExtraPost } from '../reducers/postReducer';

export var FetchCommentListRequest = (postId: number, postData?: ExtraPost):
    ThunkAction<Promise<void>, {}, {}, CommentAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, CommentAction>) => {
        try {
            var ref = firestore()
            var rq = await ref.collection('posts')
                .where('uid', '==', postId).limit(1).get()
            if (rq.docs.length > 0) {
                var targetPost = rq.docs[0]
                var ownIds: string[] = []
                let collection: CommentList = []
                var rqAll = await targetPost.ref.collection('comments').get()
                let i = 0
                while (collection.length < LIMIT_COMMENTS_PER_LOADING
                    && collection.length < rqAll.size) {
                    var rq2 = await targetPost.ref.collection('comments')
                        .orderBy('create_at', 'asc')
                        .limit(LIMIT_COMMENTS_PER_LOADING - collection.length)
                        .get()
                    i += LIMIT_COMMENTS_PER_LOADING - collection.length
                    rq2.docs.map(x => {
                        var data: ExtraComment = { ...x.data() }
                        x.ref.collection('replies')
                            .orderBy('create_at', 'asc').get().then(rq3 => {
                                let replies = rq3.docs.map(x2 => {
                                    if (ownIds.indexOf(x2.data().userId) < 0)
                                        ownIds.push(x2.data().userId)
                                    return x2.data()
                                })
                                data.replies = replies
                            })
                        if (ownIds.indexOf(x.data().userId) < 0)
                            ownIds.push(x.data().userId)
                        collection.push(data)
                    })
                }
                let ownInfos: UserInfo[] = []
                while (ownIds.length > 0) {
                    var rs = await firestore().collection('users')
                        .where('username', 'in', ownIds.splice(0, 10))
                        .get()
                    var temp: UserInfo[] = rs.docs.map(doc => {
                        return doc.data()
                    })
                    ownInfos = ownInfos.concat(temp)
                }
                collection = collection.map(comment => {
                    comment.ownUser = ownInfos.filter(x => x.username === comment.userId)[0]
                    comment.replies = comment.replies?.map(x => {
                        x.ownUser = ownInfos.filter(x2 => x2.username === x.userId)[0]
                        return x
                    })
                    return comment
                })
                if (postData) {
                    var payload: CommentExtraList = {
                        post: { ...postData },
                        comments: collection
                    }
                    dispatch(FetchCommentListSuccess(payload))
                } else {
                    let ownUser = store.getState()
                        .postList.filter(x => x.uid
                            === targetPost.data().uid)
                    var info = ownUser.length > 0 ? (ownUser[0].ownUser || {}) : {}
                    var post = {
                        ...targetPost.data(), ownUser: info,
                    }
                    var payload: CommentExtraList = {
                        post,
                        comments: collection
                    }
                    dispatch(FetchCommentListSuccess(payload))
                }



            } else dispatch(FetchCommentListFailure())
        } catch (e) {
            console.warn(e)
            dispatch(FetchCommentListFailure())
        }
    }
}
export var FetchCommentListFailure = (): CommentErrorAction => {
    return {
        type: commentActionTypes.FETCH_COMMENTS_FAILURE,
        payload: {
            message: 'Get Comments Failed!'
        }
    }
}
export var FetchCommentListSuccess = (payload: CommentExtraList):
    CommentSuccessAction<CommentExtraList> => {
    return {
        type: commentActionTypes.FETCH_COMMENTS_SUCCESS,
        payload: payload
    }
}
/**
 * LOAD MORE COMMENTS ACTIONS
 */
export var LoadMoreCommentListRequest = (postId: number):
    ThunkAction<Promise<void>, {}, {}, CommentAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, CommentAction>) => {
        try {
            var loadedCommentIds = store.getState()
                .comment.comments.map(x => x.uid)
            var ref = firestore()
            var rq = await ref.collection('posts')
                .where('uid', '==', postId).limit(1).get()
            if (rq.docs.length > 0) {

                var targetPost = rq.docs[0]
                var ownIds: string[] = []
                let collection: CommentList = []
                var rqAll = await targetPost.ref.collection('comments').get()
                while (collection.length < LIMIT_COMMENTS_PER_LOADING
                    && loadedCommentIds.length + collection.length < rqAll.size) {
                    var rq2 = await targetPost.ref.collection('comments')
                        .orderBy('create_at', 'asc')
                        .limit(LIMIT_COMMENTS_PER_LOADING + loadedCommentIds.length)
                        .get()
                    rq2.docs.map(x => {
                        if (loadedCommentIds.indexOf(x.data().uid) < 0
                            && collection.length < LIMIT_COMMENTS_PER_LOADING) {
                            var data: ExtraComment = { ...x.data() }
                            // x.ref.collection('replies')
                            //     .orderBy('create_at', 'asc').get().then(rq3 => {
                            //         let replies = rq3.docs.map(x2 => {
                            //             if (ownIds.indexOf(x2.data().userId) < 0)
                            //                 ownIds.push(x2.data().userId)
                            //             return x2.data()
                            //         })
                            //         data.replies = replies
                            //     })
                            if (ownIds.indexOf(x.data().userId) < 0)
                                ownIds.push(x.data().userId)
                            collection.push(data)
                        }
                    })
                }
                let ownInfos: UserInfo[] = []
                while (ownIds.length > 0) {
                    var rs = await firestore().collection('users')
                        .where('username', 'in', ownIds.splice(0, 10))
                        .get()
                    var temp: UserInfo[] = rs.docs.map(doc => {
                        return doc.data()
                    })
                    ownInfos = ownInfos.concat(temp)
                }
                collection = collection.map(comment => {
                    comment.ownUser = ownInfos.filter(x => x.username === comment.userId)[0]
                    comment.replies = comment.replies?.map(x => {
                        x.ownUser = ownInfos.filter(x2 => x2.username === x.userId)[0]
                        return x
                    })
                    return comment
                })
                var payload: CommentListWithScroll = {
                    comments: collection,
                    scrollDown: false
                }
                dispatch(LoadMoreCommentListSuccess(payload))
            } else { dispatch(LoadMoreCommentListFailure()) }
        } catch (e) {
            console.warn(e)
            dispatch(LoadMoreCommentListFailure())
        }
    }
}
export var ResetCommentList = () => {
    return {
        type: commentActionTypes.FETCH_COMMENTS_REQUEST,
    }
}
export var LoadMoreCommentListFailure = (): CommentErrorAction => {
    return {
        type: commentActionTypes.LOAD_MORE_COMMENTS_FAILURE,
        payload: {
            message: 'Get Comments Failed!'
        }
    }
}
export var LoadMoreCommentListSuccess = (payload: CommentListWithScroll):
    CommentSuccessAction<CommentListWithScroll> => {
    return {
        type: commentActionTypes.LOAD_MORE_COMMENTS_SUCCESS,
        payload: payload
    }
}
/**
 * TOGGLE LIKE REPLY ACTION
 */
export var ToggleLikeCommentRequest = (postId: number, commentId: number):
    ThunkAction<Promise<void>, {}, {}, CommentAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, CommentAction>) => {
        try {
            var me = store.getState().user.user.userInfo
            let commentList = [...store.getState().comment.comments]
            var ref = firestore()
            if (me?.username) {
                var username = me.username
                var rq = await ref.collectionGroup('comments')
                    .where('uid', '==', commentId).limit(1).get()
                var rq2 = await ref.collection('posts').doc(`${postId}`).get()
                if (rq.size > 0) {
                    var targetPost = rq2.data() || {}
                    var targetComment = rq.docs[0]
                    var comment: ExtraComment = targetComment.data()
                    var likes = comment.likes || []
                    var index = likes.indexOf(username)
                    if (index < 0) {
                        likes.push(username)
                    } else likes.splice(index, 1)
                    await targetComment.ref.update({
                        likes: likes
                    })

                    //add notification
                    if (targetComment.data().userId !== me?.username) {
                        let notificationList = targetPost.notificationUsers || []
                        notificationList.push(targetComment.data().userId)
                        var myIndex = notificationList.indexOf(me?.username || '')
                        if (myIndex > -1) notificationList.splice(myIndex, 1)
                        notificationList = Array.from(new Set(notificationList))
                        if (notificationList.length > 0) {
                            if (index < 0) {
                                dispatch(CreateNotificationRequest({
                                    postId,
                                    replyId: 0,
                                    commentId: commentId,
                                    userId: notificationList,
                                    from: username,
                                    create_at: Timestamp(),
                                    type: notificationTypes.LIKE_MY_COMMENT
                                }))
                            } else {
                                dispatch(CreateNotificationRequest({
                                    isUndo: true,
                                    postId,
                                    replyId: 0,
                                    commentId: commentId,
                                    userId: notificationList,
                                    from: username,
                                    create_at: Timestamp(),
                                    type: notificationTypes.LIKE_MY_COMMENT
                                }))
                            }
                        }
                    }
                    commentList = commentList.map(xComment => {
                        if (xComment.uid === comment.uid) {
                            var newComment = { ...xComment }
                            newComment.likes = likes
                            return newComment
                        }
                        return xComment
                    })

                    var payload: CommentListWithScroll = {
                        comments: commentList,
                        scrollDown: false
                    }
                    dispatch(ToggleLikeCommentSuccess(payload))

                } else dispatch(ToggleLikeCommentFailure())


            } else dispatch(ToggleLikeCommentFailure())
        } catch (e) {
            console.warn(e)
            dispatch(ToggleLikeCommentFailure())
        }
    }
}
export var ToggleLikeCommentFailure = (): CommentErrorAction => {
    return {
        type: commentActionTypes.TOGGLE_LIKE_COMMENT_FAILURE,
        payload: {
            message: 'Get Comments Failed!'
        }
    }
}
export var ToggleLikeCommentSuccess = (payload: CommentListWithScroll):
    CommentSuccessAction<CommentListWithScroll> => {
    return {
        type: commentActionTypes.TOGGLE_LIKE_COMMENT_SUCCESS,
        payload: payload
    }
}
/**
 * TOGGLE LIKE COMMMENT ACTION
 */
export var ToggleLikeReplyRequest = (replyId: number, commentId: number, postId: number):
    ThunkAction<Promise<void>, {}, {}, CommentAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, CommentAction>) => {
        try {
            var me = store.getState().user.user.userInfo
            let commentList = [...store.getState().comment.comments]
            var ref = firestore()
            if (me?.username) {
                var username = me.username
                var rq = await ref.collectionGroup('replies')
                    .where('uid', '==', replyId).limit(1).get()
                if (rq.size > 0) {
                    var targetReply = rq.docs[0]
                    var reply: ExtraComment = targetReply.data()
                    if (reply.likes) {
                        var index = reply.likes.indexOf(username)
                        if (index < 0) {
                            reply.likes.push(username)
                        } else reply.likes.splice(
                            index, 1)
                        await targetReply.ref.update({
                            likes: reply.likes
                        })
                        if (targetReply.data().userId !== me?.username) {
                            if (index < 0) {
                                dispatch(CreateNotificationRequest({
                                    postId,
                                    replyId,
                                    commentId,
                                    userId: [targetReply.data().userId],
                                    from: username,
                                    create_at: Timestamp(),
                                    type: notificationTypes.LIKE_MY_REPLY
                                }))
                            } else {
                                dispatch(CreateNotificationRequest({
                                    isUndo: true,
                                    postId,
                                    replyId,
                                    commentId,
                                    userId: [targetReply.data().userId],
                                    from: username,
                                    create_at: Timestamp(),
                                    type: notificationTypes.LIKE_MY_REPLY
                                }))
                            }
                        }
                        commentList = commentList.map(xComment => {
                            if (xComment.uid === commentId) {
                                var newComment = { ...xComment }
                                newComment.replies = xComment.replies?.map(xReply => {
                                    xReply = { ...xReply }
                                    if (xReply.uid === reply.uid) {
                                        xReply.likes = reply.likes
                                    }
                                    return xReply
                                }) || []
                                return newComment
                            }
                            return xComment
                        })

                        var payload: CommentListWithScroll = {
                            comments: commentList,
                            scrollDown: false
                        }
                        dispatch(ToggleLikeReplySuccess(payload))
                    }

                } else dispatch(ToggleLikeReplyFailure())


            } else dispatch(ToggleLikeReplyFailure())
        } catch (e) {
            console.warn(e)
            dispatch(ToggleLikeReplyFailure())
        }
    }
}
export var ToggleLikeReplyFailure = (): CommentErrorAction => {
    return {
        type: commentActionTypes.TOGGLE_LIKE_COMMENT_FAILURE,
        payload: {
            message: 'Get Comments Failed!'
        }
    }
}
export var ToggleLikeReplySuccess = (payload: CommentListWithScroll):
    CommentSuccessAction<CommentListWithScroll> => {
    return {
        type: commentActionTypes.TOGGLE_LIKE_COMMENT_SUCCESS,
        payload: payload
    }
}
/**
 * POST REPLY ACTIONS
 */
export var PostReplyRequest = (postId: number, commentId: number, content: string):
    ThunkAction<Promise<void>, {}, {}, CommentAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, CommentAction>) => {
        try {
            var me = store.getState().user.user
            let comments = [...store.getState().comment.comments]
            var ref = firestore()
            var rq = await ref.collectionGroup('comments')
                .where('uid', '==', commentId).limit(1).get()
            var rqTemp = await ref.collection('posts').doc(`${postId}`).get()
            var targetPost = rqTemp.data() || {}
            if (rq.size > 0) {
                var targetComment = rq.docs[0]
                var replyUid = new Date().getTime()
                await targetComment.ref.collection('replies').doc(`${replyUid}`)
                    .set({
                        content,
                        create_at: new Date(),
                        likes: [],
                        uid: replyUid,
                        userId: me.userInfo?.username
                    })
                var rq2 = await ref.collectionGroup('replies')
                    .where('uid', '==', replyUid).limit(1).get()
                //ADD NOTIFICATION
                var targetCommentUsername = targetComment.data().userId
                if (targetPost.userId !== me.userInfo?.username
                    && targetCommentUsername !== me.userInfo?.username) {
                    dispatch(CreateNotificationRequest({
                        postId,
                        commentId: commentId,
                        replyId: replyUid,
                        userId: [targetCommentUsername],
                        from: me.userInfo?.username,
                        create_at: Timestamp(),
                        type: notificationTypes.REPLY_MY_COMMENT
                    }))
                }

                comments = comments.map(comment => {
                    if (comment.uid === commentId) {
                        comment = { ...comment }
                        var reply: ExtraComment = rq2.docs[0].data()
                        reply.ownUser = me.userInfo
                        if (comment?.replies === undefined) {
                            comment.replies = []
                        }
                        comment.replies?.push(reply)
                    }
                    return comment
                })
                dispatch(PostReplySuccess({
                    comments: comments,
                    scrollDown: false
                }))
            } else dispatch(PostReplyFailure())
        } catch (e) {
            console.warn(e)
            dispatch(PostReplyFailure())
        }
    }
}
export var PostReplyFailure = (): CommentErrorAction => {
    return {
        type: commentActionTypes.REPLY_COMMENT_FAILURE,
        payload: {
            message: 'Can not load more posts!'
        }
    }
}
export var PostReplySuccess = (payload: CommentListWithScroll): CommentSuccessAction<CommentListWithScroll> => {
    return {
        type: commentActionTypes.REPLY_COMMENT_SUCCESS,
        payload: payload
    }
}