module.exports = {
  routes: {
    posts_page: {
      route_base: '/posts',
      controller: 'welcome-page-controller'
    },
    post_page: {
      route_base: '/post',
      controller: 'random-post-controller'
    },
    search_page: {
      route_base: '/search',
      controller: 'search-posts-controller'
    },
    user_page: {
      route_base: '/user',
      controller: 'user-profile-controller'
    },
    mixcloud_page: {
      route_base: '/mixcloud',
      controller: 'mixcloud-controller'
    },
  },
  index: '/posts'
}
