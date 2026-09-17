package com.example.inventoryapp.mapper;

import com.example.inventoryapp.dto.ItemDetailDTO;
import com.example.inventoryapp.entity.ItemDetail;
import org.springframework.stereotype.Component;

@Component
public class ItemDetailMapper {

    public ItemDetailDTO toDto(ItemDetail entity) {
        if (entity == null) return null;

        ItemDetailDTO dto = new ItemDetailDTO();
        dto.setId(entity.getId());
        dto.setDescription(entity.getDescription());
        return dto;
    }

    public ItemDetail toEntity(ItemDetailDTO dto) {
        if (dto == null) return null;

        ItemDetail entity = new ItemDetail();
        entity.setId(dto.getId());
        entity.setDescription(dto.getDescription());
        return entity;
    }

    public void updateEntityFromDto(ItemDetailDTO dto, ItemDetail entity) {
        if (dto == null || entity == null) return;

        if (dto.getDescription() != null) {
            entity.setDescription(dto.getDescription());
        }
    }
}
