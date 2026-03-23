/**
 * Image 数据结构定义
 * 定义图像存储相关的数据模型
 */

import { Timestamp, ID } from './base.js';

/**
 * 图像用途类型
 */
export enum ImagePurpose {
  /**
   * UP主头像
   * 最大尺寸: 150x150
   */
  AVATAR = 'avatar',
  /**
   * 视频封面
   * 最大尺寸: 640x360
   */
  COVER = 'cover'
}

/**
 * 图像元数据
 * 存储图像的基本信息和引用
 */
export interface ImageMetadata {
  /**
   * 图像唯一ID
   * 自动生成
   */
  id: ID;
  /**
   * 图像用途
   * 用于确定压缩尺寸
   */
  purpose: ImagePurpose;
  /**
   * 最近访问时间
   * 用于自动清理
   */
  lastAccessTime: Timestamp;
  /**
   * 创建时间
   */
  createdAt: Timestamp;
  /**
   * 图像数据引用ID
   * 关联到ImageData表的ID
   */
  dataId: ID;
}

/**
 * 图像数据
 * 存储压缩后的二进制图像数据
 */
export interface ImageData {
  /**
   * 数据唯一ID
   * 自动生成
   */
  id: ID;
  /**
   * 图像二进制数据
   * Blob格式的压缩图像
   */
  data: Blob;
}
