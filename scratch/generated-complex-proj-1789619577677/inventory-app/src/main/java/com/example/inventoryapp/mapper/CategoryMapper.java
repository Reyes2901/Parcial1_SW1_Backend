package com.example.inventoryapp.mapper;

import com.example.inventoryapp.dto.CategoryDTO;
import com.example.inventoryapp.entity.Category;
import org.springframework.stereotype.Component;

@Component
public class CategoryMapper {

    public CategoryDTO toDto(Category entity) {
        if (entity == null) return null;

        CategoryDTO dto = new CategoryDTO();
        dto.setId(entity.getId());
        dto.setTitle(entity.getTitle());
        return dto;
    }

    public Category toEntity(CategoryDTO dto) {
        if (dto == null) return null;

        Category entity = new Category();
        entity.setId(dto.getId());
        entity.setTitle(dto.getTitle());
        return entity;
    }

    public void updateEntityFromDto(CategoryDTO dto, Category entity) {
        if (dto == null || entity == null) return;

        if (dto.getTitle() != null) {
            entity.setTitle(dto.getTitle());
        }
    }
}
