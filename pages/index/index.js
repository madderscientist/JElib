var pageNum = 0;
var ifloading = false;
var keyword = "";
function searchPage(mode) {
  if(keyword){
    wx.navigateTo({
      url: '/pages/search/search?keyword=' + encodeURIComponent(keyword) + '&mode=' + mode
    });
  }else{
    wx.showToast({
      title: '要找什么谱呢？',
      icon: "error"
    });
}}
Page({
  data: {
    //true表示抽屉已展开
    drawer_mode: false,
    newlist: []
  },
  //最新谱
  news(huidiao=()=>{}){
    wx.showLoading({
      title: '搬运ing~'
    });
    wx.request({
      url: 'https://api.github.com/repos/zytx121/je/issues?page='+(++pageNum),
      timeout: 20000,
      success: ({data: arr})=>{
        for(var i=0;i<arr.length;i++){
          this.data.newlist.push({
            title: arr[i].title,
            user: arr[i].user.login,
            created_at: arr[i].created_at,
            pu: arr[i].body
          })
        }
        this.setData({
          newlist: this.data.newlist
        });
      },
      fail: (res)=>{
        wx.showToast({
          title: '失败:'+res.errMsg,
          icon: "none"
        })
      },
      complete: ()=>{wx.hideLoading();huidiao()}
    })
  },
  //点击card的事件，用全局变量传参
  tapCard(e){
    getApp().globalData.pu=this.data.newlist[e.currentTarget.dataset.pu];
    wx.navigateTo({
      url: '/pages/detail/detail'
    })
  },
  //获取输入框内容
  getkeyword(e){keyword = e.detail.value;},
  //搜索方式
  searchGithub(){searchPage(0);},
  searchAcgmuse(){searchPage(1);},
  //抽屉动画
  drawer_show() {this.setData({drawer_mode: true});},
  drawer_hide() {this.setData({drawer_mode: false})},
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {this.news()},

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {},
  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {this.drawer_hide()},
  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {},
  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.data.newlist=[];
    pageNum=0;
    this.news(()=>{wx.stopPullDownRefresh()})
  },
  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    if(ifloading) return;
    ifloading = true;
    this.news(()=>{ifloading = false});
  },
  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})