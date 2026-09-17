package com.example.inventoryapp.mapper;

import com.example.inventoryapp.dto.BookDTO;
import com.example.inventoryapp.entity.Book;
import org.springframework.stereotype.Component;

@Component
public class BookMapper {

    public BookDTO toDto(Book entity) {
        if (entity == null) return null;

        BookDTO dto = new BookDTO();
        dto.setCode(entity.getCode());
        dto.setAuthor(entity.getAuthor());
        return dto;
    }

    public Book toEntity(BookDTO dto) {
        if (dto == null) return null;

        Book entity = new Book();
        entity.setCode(dto.getCode());
        entity.setAuthor(dto.getAuthor());
        return entity;
    }

    public void updateEntityFromDto(BookDTO dto, Book entity) {
        if (dto == null || entity == null) return;

        if (dto.getAuthor() != null) {
            entity.setAuthor(dto.getAuthor());
        }
    }
}
