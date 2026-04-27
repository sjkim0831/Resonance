import { buildLocalizedPath } from "../navigation/runtime";
import { buildFormUrlEncoded, buildQueryParams, fetchLocalizedPageJson, postFormData, postFormUrlEncoded, postJson } from "./core";
import type { SitemapPagePayload } from "./appBootstrapTypes";
import type {
  BannerEditPagePayload,
  BannerManagementPagePayload,
  BannerSaveResponse,
  BoardDistributionPagePayload,
  BoardDistributionSavePayload,
  BoardDistributionSaveResponse,
  BoardManagementPagePayload,
  FaqManagementPagePayload,
  FaqSaveResponse,
  FileManagementPagePayload,
  FileManagementSaveResponse,
  PopupEditPagePayload,
  PopupListPagePayload,
  PopupSaveResponse,
  PostManagementPagePayload,
  QnaCategoryPagePayload,
  QnaCategorySavePayload,
  TagManagementPagePayload
} from "./contentTypes";

type ContentQueryParams = Record<string, string | number | boolean | null | undefined>;

function buildContentPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

async function fetchContentPageJson<T>(path: string, params?: ContentQueryParams): Promise<T> {
  const normalized = buildContentPath(path);
  return fetchLocalizedPageJson<T>(
    `/admin/api/admin/content${normalized}`,
    `/en/admin/api/admin/content${normalized}`,
    { query: buildQueryParams(params) }
  );
}

async function postContentForm<T>(path: string, payload: Record<string, string>): Promise<T> {
  const normalized = buildContentPath(path);
  return postFormUrlEncoded<T>(
    buildLocalizedPath(`/admin/api/admin/content${normalized}`, `/en/admin/api/admin/content${normalized}`),
    buildFormUrlEncoded(payload)
  );
}

async function postContentJson<T>(path: string, payload?: unknown): Promise<T> {
  const normalized = buildContentPath(path);
  return postJson<T>(
    buildLocalizedPath(`/admin/api/admin/content${normalized}`, `/en/admin/api/admin/content${normalized}`),
    payload,
    { headers: { "X-Requested-With": "XMLHttpRequest" } }
  );
}

async function postContentFormData<T>(path: string, formData: FormData): Promise<T> {
  const normalized = buildContentPath(path);
  return postFormData<T>(
    buildLocalizedPath(`/admin/api/admin/content${normalized}`, `/en/admin/api/admin/content${normalized}`),
    formData
  );
}

export async function fetchAdminSitemapPage(): Promise<SitemapPagePayload> {
  return fetchContentPageJson<SitemapPagePayload>("/sitemap");
}

export async function fetchTagManagementPage(params?: { searchKeyword?: string; status?: string; }): Promise<TagManagementPagePayload> {
  return fetchContentPageJson<TagManagementPagePayload>("/tag", params);
}

export async function fetchFaqManagementPage(params?: {
  searchKeyword?: string;
  status?: string;
  exposure?: string;
  category?: string;
  faqId?: string;
}): Promise<FaqManagementPagePayload> {
  return fetchContentPageJson<FaqManagementPagePayload>("/faq", params);
}

export async function fetchFileManagementPage(params?: {
  searchKeyword?: string;
  status?: string;
  visibility?: string;
  fileId?: string;
}): Promise<FileManagementPagePayload> {
  return fetchContentPageJson<FileManagementPagePayload>("/file", params);
}

export async function saveFileManagementPage(payload: {
  uploadFile: File;
  category: string;
  visibility: string;
  status: string;
  description: string;
}): Promise<FileManagementSaveResponse> {
  const form = new FormData();
  form.set("uploadFile", payload.uploadFile);
  form.set("category", payload.category);
  form.set("visibility", payload.visibility);
  form.set("status", payload.status);
  form.set("description", payload.description);
  return postContentFormData<FileManagementSaveResponse>("/file/save", form);
}

export async function replaceFileManagementPage(payload: {
  fileId: string;
  uploadFile: File;
}): Promise<FileManagementSaveResponse> {
  const form = new FormData();
  form.set("fileId", payload.fileId);
  form.set("uploadFile", payload.uploadFile);
  return postContentFormData<FileManagementSaveResponse>("/file/replace", form);
}

export async function deleteFileManagementPage(fileId: string): Promise<{ success: boolean; message?: string; fileId?: string; }> {
  return postContentForm("/file/delete", { fileId });
}

export async function restoreFileManagementPage(fileId: string, restoreNote?: string): Promise<FileManagementSaveResponse> {
  return postContentForm<FileManagementSaveResponse>("/file/restore", {
    fileId,
    restoreNote: restoreNote || ""
  });
}

export async function updateFileManagementPage(payload: {
  fileId: string;
  category: string;
  visibility: string;
  status: string;
  description: string;
}): Promise<FileManagementSaveResponse> {
  return postContentForm<FileManagementSaveResponse>("/file/update", {
    fileId: payload.fileId,
    category: payload.category,
    visibility: payload.visibility,
    status: payload.status,
    description: payload.description
  });
}

export async function fetchPostManagementPage(params?: {
  searchKeyword?: string;
  status?: string;
  category?: string;
  selectedPostId?: string;
}): Promise<PostManagementPagePayload> {
  return fetchContentPageJson<PostManagementPagePayload>("/post", params);
}

export async function fetchBoardDistributionPage(): Promise<BoardDistributionPagePayload> {
  return fetchContentPageJson<BoardDistributionPagePayload>("/board/detail");
}

export async function fetchBoardManagementPage(): Promise<BoardManagementPagePayload> {
  return fetchContentPageJson<BoardManagementPagePayload>("/board/list");
}

export async function saveBoardDistributionPage(payload: BoardDistributionSavePayload): Promise<BoardDistributionSaveResponse> {
  return postContentJson<BoardDistributionSaveResponse>("/board/save", payload);
}

export async function saveFaqManagementPage(payload: {
  faqId: string;
  category: string;
  question: string;
  answerScope: string;
  exposure: string;
  status: string;
  displayOrder: string;
}): Promise<FaqSaveResponse> {
  return postContentForm<FaqSaveResponse>("/faq/save", {
    faqId: payload.faqId,
    category: payload.category,
    question: payload.question,
    answerScope: payload.answerScope,
    exposure: payload.exposure,
    status: payload.status,
    displayOrder: payload.displayOrder
  });
}

export async function fetchQnaCategoryPage(params?: { searchKeyword?: string; useAt?: string; channel?: string; categoryId?: string; }): Promise<QnaCategoryPagePayload> {
  return fetchContentPageJson<QnaCategoryPagePayload>("/qna", params);
}

export async function saveQnaCategory(payload: QnaCategorySavePayload): Promise<{ success: boolean; message: string; categoryId?: string; category?: Record<string, string> }> {
  return postContentJson<{ success: boolean; message: string; categoryId?: string; category?: Record<string, string> }>("/qna/save", payload);
}

export async function deleteQnaCategory(categoryId: string): Promise<{ success: boolean; message: string; categoryId?: string }> {
  return postContentJson<{ success: boolean; message: string; categoryId?: string }>("/qna/delete", { categoryId });
}

export async function fetchBannerManagementPage(params?: {
  searchKeyword?: string;
  status?: string;
  placement?: string;
  selectedBannerId?: string;
}): Promise<BannerManagementPagePayload> {
  return fetchContentPageJson<BannerManagementPagePayload>("/banner", params);
}

export async function fetchBannerEditPage(bannerId: string): Promise<BannerEditPagePayload> {
  return fetchContentPageJson<BannerEditPagePayload>("/banner/detail", bannerId ? { bannerId } : undefined);
}

export async function saveBannerEditPage(payload: {
  bannerId: string;
  title: string;
  targetUrl: string;
  status: string;
  startAt: string;
  endAt: string;
}): Promise<BannerSaveResponse> {
  return postContentForm<BannerSaveResponse>("/banner/save", {
    bannerId: payload.bannerId,
    title: payload.title,
    targetUrl: payload.targetUrl,
    status: payload.status,
    startAt: payload.startAt,
    endAt: payload.endAt
  });
}

export async function fetchPopupEditPage(popupId: string): Promise<PopupEditPagePayload> {
  return fetchContentPageJson<PopupEditPagePayload>("/popup/detail", popupId ? { popupId } : undefined);
}

export async function fetchPopupListPage(params?: {
  searchKeyword?: string;
  status?: string;
  targetAudience?: string;
  selectedPopupId?: string;
}): Promise<PopupListPagePayload> {
  return fetchContentPageJson<PopupListPagePayload>("/popup", params);
}

export async function savePopupEditPage(payload: {
  popupId: string;
  popupTitle: string;
  popupType: string;
  exposureStatus: string;
  priority: string;
  useAt: string;
  targetAudience: string;
  displayScope: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  closePolicy: string;
  width: string;
  height: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  ownerName: string;
  ownerContact: string;
  notes: string;
}): Promise<PopupSaveResponse> {
  return postContentJson<PopupSaveResponse>("/popup/save", payload);
}
