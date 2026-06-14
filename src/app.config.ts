export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/order/index',
    'pages/schedule/index',
    'pages/settlement/index',
    'pages/map-dispatch/index',
    'pages/maintenance/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#2E8B57',
    navigationBarTitleText: '农机合作社调度',
    navigationBarTextStyle: 'white',
    backgroundColor: '#F5F9F3'
  },
  tabBar: {
    color: '#86909C',
    selectedColor: '#2E8B57',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '看板'
      },
      {
        pagePath: 'pages/order/index',
        text: '下单'
      },
      {
        pagePath: 'pages/schedule/index',
        text: '日程'
      },
      {
        pagePath: 'pages/settlement/index',
        text: '结算'
      }
    ]
  }
})
