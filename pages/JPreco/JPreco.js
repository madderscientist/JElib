import {
    JPreco,
    JPrecoTools,
    jsPic,
    JPnote
} from './jpnet/JPreco';
import {
    loadModel,
    reco
} from './jpnet/model'
import {
    path2canvas,
    data2canvas,
    exportcanvas
} from './jpnet/canvas'

var c = null;
var ctx = null;
var jpreco = null; // 识别类
var tone2midi = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

Page({
    data: {
        canvasWidth: 1,
        canvasHeight: 1,
        showTools: 'none',
        // 五度圈
        ToneArray: [{
            id: 0,
            label: 'C调'
        }, {
            id: 1,
            label: 'G调'
        }, {
            id: 2,
            label: 'D调'
        }, {
            id: 3,
            label: 'A调'
        }, {
            id: 4,
            label: 'E调'
        }, {
            id: 5,
            label: 'B调'
        }, {
            id: 6,
            label: 'F#'
        }, {
            id: 7,
            label: 'C#'
        }, {
            id: 8,
            label: 'Ab'
        }, {
            id: 9,
            label: 'Eb'
        }, {
            id: 10,
            label: 'Bb'
        }, {
            id: 11,
            label: 'F调'
        }],
        picker1: 2, // 记录的是五度圈的编号
        picker2: 0
    },
    // 下拉框
    select_from(e) {
        this.setData({
            picker1: e.detail.id
        });
    },
    select_to(e) {
        this.setData({
            picker2: e.detail.id
        });
    },
    // 半音升降
    upx(by) {
        if (by == 0) return;
        wx.showLoading({
            title: '转换中',
            mask: true
        });
        // 升就用升记号，降就用降记号
        JPnote.switchMode(by > 0);
        data2canvas(jpreco.upx(by), ctx, c);
        this.updateCanvasSize();
        wx.hideLoading();
    },
    // 输入是五度圈的编号
    tone(from, to) {
        wx.showLoading({
            title: '转换中',
            mask: true
        });
        // from和to都是五度圈中的编号
        JPnote.switchMode(((to - from) % 12 + 12) % 12 > 4); // 五度圈中如果大于4则用升记号
        // upx用的是MIDI编号
        let fromMIDI = tone2midi[from];
        let toMIDI = tone2midi[to];
        let by = fromMIDI - toMIDI;
        if (by > 6) by -= 12;
        if (by < -6) by += 12;
        data2canvas(jpreco.upx(by), ctx, c);
        this.updateCanvasSize();
        wx.hideLoading();
    },
    ToneConvert() {
        this.tone(this.data.picker1, this.data.picker2);
    },
    // 半音转换
    up1() {
        this.upx(1);
    },
    down1() {
        this.upx(-1);
    },
    // 下载
    download() {
        exportcanvas(c);
    },
    // 用户选择图片后的操作，需要完成检测并绘制到图中
    chooseImg() {
        this.userSelectImg().then((path) => {
            wx.showLoading({
                title: '分析中',
            });
            return path2canvas(c, ctx, path);
        }).then((imgdata) => {
            jpreco = new JPreco(imgdata, reco);
            jpreco.reco((txt) => true).then((success) => {
                if (!success) throw new Error("分析失败");
                data2canvas(jpreco.upx(0), ctx, c);
                this.updateCanvasSize();
                // 设置工具可见
                this.setData({
                    showTools: 'block',
                });
                wx.hideLoading();
            }).catch((e) => {
                wx.hideLoading();
                wx.showToast({
                    title: '分析失败请重试',
                    icon: 'error',
                    duration: 2000
                });
                console.log(e);
            });
        }).catch((e) => {
            console.log(e);
            wx.hideLoading();
        });
    },
    // Promise，返回文件路径
    userSelectImg() {
        return new Promise((resolve, reject) => {
            wx.chooseMedia({
                count: 1,
                mediaType: ['image'],
                sourceType: ['album'],
                sizeType: ['original'],
                success: (res) => {
                    resolve(res.tempFiles[0].tempFilePath);
                },
                fail: reject
            })
        })
    },
    updateCanvasSize() {
        const screenInfo = wx.getSystemInfoSync();
        this.setData({
            canvasWidth: screenInfo.screenWidth,
            canvasHeight: Math.round(screenInfo.screenWidth * c.height / c.width)
        });
    },
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad() {
        loadModel();
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {
        wx.createSelectorQuery().select('#picShow').fields({
            node: true,
            size: true
        }).exec((res) => {
            c = res[0].node;
            ctx = c.getContext('2d');
            // ImageData的初始化
            jsPic.initImageData(c);
            // 读取图片
            JPnote.init((path) => {
                // 不用createOffscreenCanvas是因为不知道为什么返回null:const c = wx.createOffscreenCanvas({type:'2d'}); const ctx = c.getContext('2d');
                // 路径要以本文件为根源，找相对路径。path是'notes/0.jpg'这样的文件名
                return path2canvas(c, ctx, './jpnet/' + path);
            }).then(() => {
                console.log("notes loaded");
            }).catch((e)=>{
                console.log("notes failed", e);
            });
        })
    },
});