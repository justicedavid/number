import { firestore } from 'firebase';
import { ThunkAction, ThunkDispatch } from "redux-thunk";
import { store } from "../store";
import { userXActionTypes, SuccessAction, ProfileX, userXAction, ErrorAction } from '../reducers/profileXReducer';

export let FetchProfileXRequest = (username: string):
    ThunkAction<Promise<void>, {}, {}, userXAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userXAction>) => {
        try {
            let myUsername = store.getState().user.user.userInfo?.username || ''
            let ref = firestore()
            let rq = await ref.collection('users').doc(username).get()
            let me = await ref.collection('users').doc(myUsername).get()
            if (rq.exists) {
                let data: ProfileX = rq.data() || {}
                let myUserData: ProfileX = me.data() || {}
                let myBlockList = myUserData.privacySetting?.blockedAccounts?.blockedAccounts || []
                if (((data.privacySetting?.blockedAccounts?.blockedAccounts || [])
                    .indexOf(myUsername)) > -1
                    || myBlockList.indexOf(username) > -1) data.isBlock = true
                else data.isBlock = false
                let photos = await ref.collection('posts')
                    .where('userId', '==', username)
                    .orderBy('create_at', 'desc')
                    .get()
                let tagPhotos = await ref.collection('posts')
                    .where('tagUsername', 'array-contains', username)
                    .orderBy('create_at', 'desc')
                    .get()
                data.posts = photos.docs.map(x => x.data() || {})
                data.tagPhotos = tagPhotos.docs.map(x => x.data() || {})
                let followers = await ref.collection('users')
                    .where('followings', 'array-contains', username).get()
                data.followers = followers.docs.map(x => x.data().username) || []
                let index = data.followers.indexOf(username)
                if (index > -1) data.followers.splice(index, 1)
                data.mutualFollowings = (data.followings || []).filter(usr =>
                    (myUserData.followings || []).indexOf(usr) > -1
                    && usr !== myUsername
                    && usr !== username
                )
                dispatch(FetchProfileXSuccess(data))
            } else dispatch(FetchProfileXFailure())
        } catch (e) {
            console.warn(e)
            dispatch(FetchProfileXFailure())
        }
    }
}
export let ResetProfileXRequest = ():
    ThunkAction<Promise<void>, {}, {}, userXAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userXAction>) => {
        dispatch(FetchProfileXSuccess({}))
    }
}
export let FetchProfileXFailure = (): ErrorAction => {
    return {
        type: userXActionTypes.FETCH_PROFILEX_FAILURE,
        payload: {
            message: `This profile doesn't exists`
        }
    }
}
export let FetchProfileXSuccess = (payload: ProfileX): SuccessAction<ProfileX> => {
    return {
        type: userXActionTypes.FETCH_PROFILEX_SUCCESS,
        payload: payload
    }
}