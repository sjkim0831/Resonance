export type TagManagementPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  searchKeyword?: string;
  status?: string;
  summaryCards?: Array<Record<string, string>>;
  tagRows?: Array<Record<string, string>>;
  usageRows?: Array<Record<string, string>>;
  governanceNotes?: Array<Record<string, string>>;
};

export type FaqManagementPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  searchKeyword?: string;
  status?: string;
  exposure?: string;
  category?: string;
  selectedFaqId?: string;
  summaryCards?: Array<Record<string, string>>;
  faqRows?: Array<Record<string, string>>;
  selectedFaq?: Record<string, string>;
  governanceNotes?: Array<Record<string, string>>;
};

export type FileManagementPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  searchKeyword?: string;
  status?: string;
  visibility?: string;
  selectedFileId?: string;
  summaryCards?: Array<Record<string, string>>;
  fileRows?: Array<Record<string, string>>;
  selectedFile?: Record<string, string>;
  selectedFileHistory?: Array<Record<string, string>>;
  deletedFileRows?: Array<Record<string, string>>;
  governanceNotes?: Array<Record<string, string>>;
};

export type FileManagementSaveResponse = {
  success: boolean;
  message?: string;
  fileId?: string;
  file?: Record<string, string>;
};

export type PostManagementPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  searchKeyword?: string;
  status?: string;
  category?: string;
  summaryCards?: Array<Record<string, string>>;
  categoryOptions?: Array<Record<string, string>>;
  postRows?: Array<Record<string, string>>;
  selectedPost?: Record<string, string> | null;
  governanceNotes?: Array<Record<string, string>>;
};

export type BoardDistributionPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  draftId?: string;
  draftDetail?: Record<string, unknown>;
  summaryCards?: Array<Record<string, string>>;
  governanceNotes?: Array<Record<string, string>>;
};

export type BoardManagementPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  summaryCards?: Array<Record<string, string>>;
  boardTypeOptions?: Array<Record<string, string>>;
  boardRows?: Array<Record<string, string>>;
  selectedBoard?: Record<string, string> | null;
  governanceNotes?: Array<Record<string, string>>;
};

export type BoardDistributionSavePayload = {
  draftId?: string;
  boardType: string;
  audience: string;
  title: string;
  summary: string;
  body: string;
  publishAt: string;
  expireAt: string;
  channels: string[];
  tags: string[];
  pinned: boolean;
  urgent: boolean;
  allowComments: boolean;
};

export type BoardDistributionSaveResponse = Record<string, unknown> & {
  saved?: boolean;
  draftId?: string;
  message?: string;
  draftDetail?: Record<string, unknown>;
};

export type QnaCategoryPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  searchKeyword?: string;
  useAt?: string;
  channel?: string;
  selectedCategoryId?: string;
  summaryCards?: Array<Record<string, string>>;
  categoryRows?: Array<Record<string, string>>;
  selectedCategory?: Record<string, string>;
  governanceNotes?: Array<Record<string, string>>;
  integrationNotes?: Array<Record<string, string>>;
};

export type QnaCategorySavePayload = {
  categoryId?: string;
  code: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  channel: string;
  useAt: string;
  sortOrder: number;
  ownerKo: string;
  ownerEn: string;
};

export type BannerManagementPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  searchKeyword?: string;
  status?: string;
  placement?: string;
  summaryCards?: Array<Record<string, string>>;
  bannerRows?: Array<Record<string, string | number>>;
  selectedBanner?: Record<string, string | number> | null;
  placementOptions?: Array<Record<string, string>>;
};

export type BannerEditPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  bannerId?: string;
  bannerDetail?: Record<string, string | number>;
  statusOptions?: Array<Record<string, string>>;
  placementOptions?: Array<Record<string, string>>;
  summaryCards?: Array<Record<string, string>>;
};

export type BannerSaveResponse = Record<string, unknown> & {
  saved?: boolean;
  bannerId?: string;
  message?: string;
  bannerDetail?: Record<string, string | number>;
};

export type PopupListPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  searchKeyword?: string;
  status?: string;
  targetAudience?: string;
  summaryCards?: Array<Record<string, string>>;
  statusOptions?: Array<Record<string, string>>;
  targetAudienceOptions?: Array<Record<string, string>>;
  popupRows?: Array<Record<string, string | number>>;
  selectedPopup?: Record<string, string | number>;
  governanceNotes?: Array<Record<string, string>>;
};

export type PopupEditPagePayload = Record<string, unknown> & {
  isEn?: boolean;
  menuCode?: string;
  popupId?: string;
  popupDetail?: Record<string, string | number>;
  summaryCards?: Array<Record<string, string>>;
  popupTypeOptions?: Array<Record<string, string>>;
  priorityOptions?: Array<Record<string, string>>;
  exposureStatusOptions?: Array<Record<string, string>>;
  useAtOptions?: Array<Record<string, string>>;
  targetAudienceOptions?: Array<Record<string, string>>;
  displayScopeOptions?: Array<Record<string, string>>;
  closePolicyOptions?: Array<Record<string, string>>;
};

export type PopupSaveResponse = Record<string, unknown> & {
  saved?: boolean;
  popupId?: string;
  message?: string;
  popupDetail?: Record<string, string | number>;
};

export type FaqSaveResponse = Record<string, unknown> & {
  saved?: boolean;
  faqId?: string;
  message?: string;
  faq?: Record<string, string>;
};
