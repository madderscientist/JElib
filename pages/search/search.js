const htmlTomd=require("./htmlTomd.js") //html转md
Page({
  data: {
    result: [],
    keyword: "",
    mode: 0
  },
  tapCard(e){
    getApp().globalData.pu=this.data.result[e.currentTarget.dataset.pu];
    wx.navigateTo({
      url: '/pages/detail/detail'
    })
  },
  search(){
    wx.showLoading({
      title: '翻箱倒柜ing',
    });
    this.data.result=[];
    wx.request({
      url: this.data.mode ? `https://www.acgmuse.com/api/discussions?include=mostRelevantPost&filter%5Bq%5D=${this.data.keyword}`:`https://api.github.com/search/issues?q=${this.data.keyword}+state:open+repo:zytx121/je`,
      timeout: 20000,
      success: ({data:res})=>{
        if(this.data.mode){
          var arr=res.included;
          var titles=res.data;
          for(var i=0;i<arr.length;i++){
            this.data.result.push({
              title: titles[i].attributes.title,
              user: "",
              created_at: titles[i].attributes.createdAt,
              pu: htmlTomd.html2md(arr[i].attributes.contentHtml)
            })
          }
        }else{
          var arr=res.items;
          for(var i=0;i<arr.length;i++){
            this.data.result.push({
              title: arr[i].title,
              user: arr[i].user.login,
              created_at: arr[i].created_at,
              pu: arr[i].body
            })
          }
        }
        this.setData({
          result: this.data.result
        })
      },
      fail: (res)=>{
        wx.showToast({
          title: '失败:'+res.errMsg,
          icon: "none"
        })
      },
      complete: ()=>{wx.hideLoading();}
    })
  },
  // 生命周期函数--监听页面加载
  onLoad(options) {
    this.setData({
      keyword: options.keyword,
      mode: Number(options.mode)
    });
    this.search();
  },

  // 生命周期函数--监听页面初次渲染完成
  onReady() {
    wx.setNavigationBarTitle({
      title: decodeURIComponent(this.data.keyword)
    });
  },

  // 生命周期函数--监听页面显示
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  // 页面相关事件处理函数--监听用户下拉动作
  onPullDownRefresh() {
    this.search();
  },

  // 页面上拉触底事件的处理函数
  onReachBottom() {
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})