export const snoopRoutes = [
  {
    path: '/phone',
    name: 'phone',
    component: () => import('./views/PhoneContactPicker.vue')
  },
  {
    path: '/snoop/:contactId',
    name: 'snoop',
    component: () => import('./views/SnoopPhoneView.vue')
  }
]
