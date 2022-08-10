// 本地谱以及工具栏
Page({
  data: {
    keys: []
  },
  getMy(){
    wx.getStorageInfo({
      success: (option) => {
        this.setData({keys: option.keys})
      },
    })
  },
  tapCard(e){
    wx.getStorage({
      key: e.currentTarget.dataset.pu,
      success (res) {
        getApp().globalData.pu={
          title: e.currentTarget.dataset.pu,
          parsedData: res.data
        };
        wx.navigateTo({
          url: '/pages/detail/detail'
        })
      }
    })
  },
  dele(e){
    wx.showModal({
      title: "是否删除该谱？",
      success: (res)=>{
        if(res.confirm){
          wx.removeStorage({
            key: e.currentTarget.dataset.pu,
            success: ()=>{
              wx.showToast({
                title: '删除成功！'
              });
              this.getMy()
            },
            fail: ()=>{
              wx.showToast({
                title: '删除失败！',
                icon: "error"
              })
            }
          })
        }
      },
      fail: ()=>{
        wx.showToast({
          title: '对话框显示失败！'
        })
      }
    })
  },
  copyurl(e){
    wx.setClipboardData({
      data: e.currentTarget.dataset.url,
      success: ()=>{
        wx.showToast({
          title: '已复制到剪贴板',
        })
      }
    })
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.getMy();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },
  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})