var app=getApp();
Page({
  data: {
    title: "",
    md: "",
    al: null,
    user: "",
    created_at: "",
    pannelShow: false,
    pannelContent: "",
    love: "🤍"
  },
  showpannel(e){
    this.setData({
      pannelContent: e.detail,
      pannelShow: true
    })
  },
  closePannel(){
    this.setData({
      pannelShow: false
    });
  },
  confirm(){
    var Convert=this.selectComponent("#Convert");
    var wemark=this.selectComponent("#md");
    wemark.changeSelected(Convert.data.pu);
    this.closePannel();
  },
  like(){
    if(this.data.love=="❤") return;
    if(this.data.love=="保存"){
      wx.setStorage({
        key: this.data.title,
        data: this.selectComponent("#md").data.parsedData,
        success: ()=>{
          wx.showToast({
            title: '更改成功！'
          })
        },
        fail: ()=>{
          wx.showToast({
            title: '更改失败...',
            icon: "error"
          })
        }
      })
      return;
    }

    wx.showModal({
      title: "保存至本地",
      editable: true,
      content: this.data.title,
      success: (res)=>{
        if(res.confirm){
          wx.getStorage({ //重名检查
            key: res.content,
            success () {
              wx.showToast({
                title: '已有同名谱!',
                icon: "error"
              })
            },
            fail: ()=>{
              wx.setStorage({
                key: res.content,
                data: this.selectComponent("#md").data.parsedData,
                success: ()=>{
                  wx.showToast({
                    title: '保存成功！'
                  });
                  this.setData({
                    love: "❤"
                  })
                },
                fail: ()=>{
                  wx.showToast({
                    title: '保存失败...',
                    icon: "error"
                  })
                }
              })
            }
          })
        }
      },
      fail: ()=>{
        wx.showToast({
          title: '对话框弹出失败！',
          icon: "error"
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
    // 从全局变量pu中读取数据，如果pu.parsedData有值就无所谓除title外其他参数
    this.setData({
      title: app.globalData.pu.title?app.globalData.pu.title:"",
      md: app.globalData.pu.pu?app.globalData.pu.pu:"",
      user: app.globalData.pu.user?app.globalData.pu.user:"",
      created_at: app.globalData.pu.created_at?app.globalData.pu.created_at:"",
      al: app.globalData.pu.parsedData?app.globalData.pu.parsedData:null
    });
    if(!this.data.md)
      this.setData({
        love: "保存"
      })
    wx.setNavigationBarTitle({
      title: this.data.title
    })
  },
  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})